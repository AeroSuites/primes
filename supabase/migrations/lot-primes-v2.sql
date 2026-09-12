-- ============================================================
-- AeroPrimes v2 — catégories de prime, validation par pastilles,
-- suppression des montants et gestion des comptes agents
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ============================================================

-- 1) Catégorie choisie par le manager lors de la validation (V034 / V035)
alter table public.declarations
  add column if not exists categorie text not null default '';

-- 2) Les nouvelles déclarations ne portent plus de montant
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
begin
  if length(coalesce(p_description, '')) = 0 then
    return jsonb_build_object('error', 'description_requise');
  end if;

  insert into public.declarations (
    agent_identifiant, agent_nom, avion, element,
    date_intervention, description, montant, statut
  )
  values (
    trim(lower(p_identifiant)),
    coalesce(p_nom, ''),
    coalesce(p_avion, ''),
    coalesce(p_element, ''),
    p_date_intervention,
    p_description,
    null,
    'soumise'
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- 3) L'agent voit la catégorie une fois la déclaration validée
create or replace function public.my_declarations(p_identifiant text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  list jsonb;
begin
  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
  into list
  from (
    select id::text as id,
           agent_identifiant,
           avion, element, date_intervention, description,
           categorie, montant, statut, motif_refus, decided_by, decided_at, created_at
    from public.declarations
    where lower(agent_identifiant) = trim(lower(p_identifiant))
  ) t;

  return jsonb_build_object('ok', true, 'declarations', list);
end;
$$;

-- 4) Liste manager (admin) avec catégorie
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
  list jsonb;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  if p_statut = '' then
    select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
    into list
    from (
      select id::text as id, agent_identifiant, agent_nom, avion, element,
             date_intervention, description, categorie, montant, statut, motif_refus,
             decided_by, decided_at, created_at
      from public.declarations
    ) t;
  else
    select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
    into list
    from (
      select id::text as id, agent_identifiant, agent_nom, avion, element,
             date_intervention, description, categorie, montant, statut, motif_refus,
             decided_by, decided_at, created_at
      from public.declarations
      where statut = p_statut
    ) t;
  end if;

  return jsonb_build_object('ok', true, 'declarations', list);
end;
$$;

-- 5) Validation : le manager choisit obligatoirement la catégorie
drop function if exists public.admin_validate_declaration(text, uuid);

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
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  if p_categorie not in ('V034', 'V035') then
    return jsonb_build_object('error', 'categorie_invalide');
  end if;

  update public.declarations
  set statut = 'validee',
      categorie = p_categorie,
      decided_at = now(),
      decided_by = 'admin',
      motif_refus = ''
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 6) Compteur de primes en attente (bulle de notification)
create or replace function public.admin_pending_primes_count(p_admin_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  n bigint;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select count(*) into n from public.declarations where statut = 'soumise';
  return jsonb_build_object('ok', true, 'count', n);
end;
$$;

-- 7) Liste des comptes agents (avec compteurs de déclarations)
create or replace function public.admin_list_agents(p_admin_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  list jsonb;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

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
    group by a.id, a.identifiant, a.nom, a.actif, a.created_at
  ) t;

  return jsonb_build_object('ok', true, 'agents', list);
end;
$$;

-- 8) Activer / désactiver un compte agent (connexion bloquée si inactif)
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
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  update public.agents
  set actif = coalesce(p_actif, true)
  where lower(identifiant) = trim(lower(p_identifiant));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 9) Supprimer un compte agent (les déclarations restent dans l'historique)
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
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  delete from public.agents
  where lower(identifiant) = trim(lower(p_identifiant));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
