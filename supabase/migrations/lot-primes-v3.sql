-- ============================================================
-- AeroPrimes v3 — chaque agent est rattaché à son manager
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
--
-- - la table admins reçoit un id public (uuid) : les codes admin
--   restent secrets (hachés), seuls l'id et le nom sont exposés
-- - l'agent choisit son manager à l'inscription (menu déroulant)
-- - chaque déclaration est routée vers le manager de l'agent
-- - chaque manager ne voit / ne traite que ses agents et leurs
--   déclarations (les anciens enregistrements sans manager et
--   ceux dont le manager a été supprimé restent visibles par tous)
-- ============================================================

-- 1) Identifiant public des administrateurs (le code reste haché)
--    + garde-fou : colonne nom si lot-admins-multi.sql n'a pas encore été exécuté
alter table public.admins
  add column if not exists name text not null default '';

update public.admins set name = 'Admin'
where coalesce(trim(name), '') = '' and (select count(*) from public.admins) = 1;

alter table public.admins
  add column if not exists id uuid not null default gen_random_uuid();

create unique index if not exists admins_id_key on public.admins (id);

-- 2) Rattachement des agents et des déclarations à un manager
alter table public.agents
  add column if not exists manager_id uuid;

alter table public.declarations
  add column if not exists manager_id uuid;

create index if not exists declarations_manager_idx
  on public.declarations (manager_id, statut, created_at desc);

-- 3) Menu déroulant public des managers (jamais les codes)
create or replace function public.list_managers()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true, 'managers',
    coalesce(jsonb_agg(t order by t.name), '[]'::jsonb))
  from (
    select id::text as id, coalesce(nullif(trim(name), ''), 'Manager') as name
    from public.admins
  ) t;
$$;

-- 4) Inscription : manager obligatoire pour créer le compte
drop function if exists public.signup_agent(text, text, text);

create or replace function public.signup_agent(
  p_identifiant text,
  p_nom text,
  p_mdp text,
  p_manager_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ident text;
begin
  ident := trim(lower(p_identifiant));

  if length(ident) < 3 then
    return jsonb_build_object('error', 'identifiant_court');
  end if;

  if length(coalesce(p_mdp, '')) < 8 then
    return jsonb_build_object('error', 'mdp_court');
  end if;

  if p_manager_id is null
     or not exists (select 1 from public.admins where id = p_manager_id) then
    return jsonb_build_object('error', 'manager_requis');
  end if;

  if exists (select 1 from public.agents where lower(identifiant) = ident) then
    return jsonb_build_object('error', 'identifiant_utilise');
  end if;

  insert into public.agents (identifiant, nom, mdp_hash, manager_id)
  values (ident, trim(coalesce(p_nom, '')), crypt(p_mdp, gen_salt('bf')), p_manager_id);

  return jsonb_build_object('ok', true);
end;
$$;

-- 5) Soumission : la déclaration hérite du manager de l'agent
create or replace function public.agent_submit_declaration(
  p_identifiant text,
  p_nom text,
  p_avion text,
  p_element text,
  p_date_intervention date,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_manager uuid;
begin
  if length(coalesce(p_description, '')) = 0 then
    return jsonb_build_object('error', 'description_requise');
  end if;

  select manager_id into v_manager
  from public.agents
  where lower(identifiant) = trim(lower(p_identifiant));

  insert into public.declarations (
    agent_identifiant, agent_nom, avion, element,
    date_intervention, description, montant, statut, manager_id
  )
  values (
    trim(lower(p_identifiant)),
    coalesce(p_nom, ''),
    coalesce(p_avion, ''),
    coalesce(p_element, ''),
    p_date_intervention,
    p_description,
    null,
    'soumise',
    v_manager
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- 6) Liste manager (admin) : uniquement ses déclarations
create or replace function public.admin_list_declarations(
  p_admin_code text,
  p_statut text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
  list jsonb;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  if p_statut = '' then
    select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
    into list
    from (
      select d.id::text as id, d.agent_identifiant, d.agent_nom, d.avion, d.element,
             d.date_intervention, d.description, d.categorie, d.montant, d.statut,
             d.motif_refus, d.decided_by, d.decided_at, d.created_at
      from public.declarations d
      where d.manager_id is null
         or d.manager_id = v_admin_id
         or not exists (select 1 from public.admins a where a.id = d.manager_id)
    ) t;
  else
    select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
    into list
    from (
      select d.id::text as id, d.agent_identifiant, d.agent_nom, d.avion, d.element,
             d.date_intervention, d.description, d.categorie, d.montant, d.statut,
             d.motif_refus, d.decided_by, d.decided_at, d.created_at
      from public.declarations d
      where d.statut = p_statut
        and (d.manager_id is null
             or d.manager_id = v_admin_id
             or not exists (select 1 from public.admins a where a.id = d.manager_id))
    ) t;
  end if;

  return jsonb_build_object('ok', true, 'declarations', list);
end;
$$;

-- 7) Validation : uniquement une déclaration de son périmètre
create or replace function public.admin_validate_declaration(
  p_admin_code text,
  p_id uuid,
  p_categorie text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  if p_categorie not in ('V034', 'V035') then
    return jsonb_build_object('error', 'categorie_invalide');
  end if;

  update public.declarations d
  set statut = 'validee',
      categorie = p_categorie,
      decided_at = now(),
      decided_by = 'admin',
      motif_refus = ''
  where d.id = p_id
    and (d.manager_id is null
         or d.manager_id = v_admin_id
         or not exists (select 1 from public.admins a where a.id = d.manager_id));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 8) Refus : uniquement une déclaration de son périmètre
create or replace function public.admin_refuse_declaration(
  p_admin_code text,
  p_id uuid,
  p_motif text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  if length(coalesce(p_motif, '')) = 0 then
    return jsonb_build_object('error', 'motif_requis');
  end if;

  update public.declarations d
  set statut = 'refusee',
      motif_refus = trim(p_motif),
      decided_at = now(),
      decided_by = 'admin'
  where d.id = p_id
    and (d.manager_id is null
         or d.manager_id = v_admin_id
         or not exists (select 1 from public.admins a where a.id = d.manager_id));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 9) Compteur en attente : uniquement son périmètre (bulle)
create or replace function public.admin_pending_primes_count(p_admin_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
  n bigint;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  select count(*) into n
  from public.declarations d
  where d.statut = 'soumise'
    and (d.manager_id is null
         or d.manager_id = v_admin_id
         or not exists (select 1 from public.admins a where a.id = d.manager_id));

  return jsonb_build_object('ok', true, 'count', n);
end;
$$;

-- 10) Comptes agents : uniquement ses agents
create or replace function public.admin_list_agents(p_admin_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
  list jsonb;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
  into list
  from (
    select a.identifiant, a.nom, a.actif, a.created_at,
           count(d.id) filter (where d.statut = 'soumise') as en_attente,
           count(d.id) filter (where d.statut = 'validee') as validees,
           count(d.id) as total
    from public.agents a
    left join public.declarations d
      on lower(d.agent_identifiant) = lower(a.identifiant)
    where a.manager_id is null
       or a.manager_id = v_admin_id
       or not exists (select 1 from public.admins m where m.id = a.manager_id)
    group by a.id, a.identifiant, a.nom, a.actif, a.created_at
  ) t;

  return jsonb_build_object('ok', true, 'agents', list);
end;
$$;

-- 11) Activer / désactiver : uniquement ses agents
create or replace function public.admin_set_agent_actif(
  p_admin_code text,
  p_identifiant text,
  p_actif boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  update public.agents a
  set actif = coalesce(p_actif, true)
  where lower(a.identifiant) = trim(lower(p_identifiant))
    and (a.manager_id is null
         or a.manager_id = v_admin_id
         or not exists (select 1 from public.admins m where m.id = a.manager_id));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 12) Supprimer : uniquement ses agents (déclarations conservées)
create or replace function public.admin_delete_agent(
  p_admin_code text,
  p_identifiant text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  v_admin_id uuid;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select id into v_admin_id
  from public.admins
  where crypt(p_admin_code, code_hash) = code_hash
  limit 1;

  delete from public.agents a
  where lower(a.identifiant) = trim(lower(p_identifiant))
    and (a.manager_id is null
         or a.manager_id = v_admin_id
         or not exists (select 1 from public.admins m where m.id = a.manager_id));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
