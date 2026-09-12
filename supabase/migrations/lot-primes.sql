-- ============================================================
-- AeroPrimes — déclarations prime toilettes (agents indépendants)
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
--
-- - agents : comptes propres aux agents (mot de passe haché bcrypt)
-- - declarations : les demandes de prime (soumise / validee / refusee)
-- - prime_config : montant unitaire configurable par le manager
-- Les agents n'utilisent PAS Aeroteam : ils se connectent au site
-- AeroPrimes avec leur identifiant + mot de passe.
-- ============================================================

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  identifiant text not null unique,
  nom text not null default '',
  mdp_hash text not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.declarations (
  id uuid primary key default gen_random_uuid(),
  agent_identifiant text not null,
  agent_nom text not null default '',
  avion text not null default '',
  element text not null default '',
  date_intervention date,
  description text not null default '',
  montant numeric(8,2),
  statut text not null default 'soumise',
  motif_refus text not null default '',
  decided_by text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists declarations_agent_idx
  on public.declarations (agent_identifiant, created_at desc);

create index if not exists declarations_statut_idx
  on public.declarations (statut, created_at desc);

create table if not exists public.prime_config (
  id integer primary key default 1 check (id = 1),
  montant numeric(8,2) not null default 5
);

insert into public.prime_config (id, montant) values (1, 5) on conflict (id) do nothing;

alter table public.agents enable row level security;
alter table public.declarations enable row level security;
alter table public.prime_config enable row level security;

-- ---------- AGENTS (inscription / connexion) ----------

create or replace function public.signup_agent(
  p_identifiant text,
  p_nom text,
  p_mdp text
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

  if exists (select 1 from public.agents where lower(identifiant) = ident) then
    return jsonb_build_object('error', 'identifiant_utilise');
  end if;

  insert into public.agents (identifiant, nom, mdp_hash)
  values (ident, trim(coalesce(p_nom, '')), crypt(p_mdp, gen_salt('bf')));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.login_agent(
  p_identifiant text,
  p_mdp text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ident text;
  h text;
  a_nom text;
  a_actif boolean;
begin
  ident := trim(lower(p_identifiant));

  if public.too_many_attempts('agent', ident) then
    return jsonb_build_object('ok', false, 'locked', true);
  end if;

  select mdp_hash, nom, actif into h, a_nom, a_actif
  from public.agents
  where lower(identifiant) = ident;

  if not found then
    perform public.record_failed_attempt('agent', ident);
    return jsonb_build_object('ok', false, 'locked', false);
  end if;

  if not a_actif then
    return jsonb_build_object('ok', false, 'locked', false, 'inactif', true);
  end if;

  if crypt(coalesce(p_mdp, ''), h) = h then
    perform public.clear_attempts('agent', ident);
    return jsonb_build_object('ok', true, 'identifiant', ident, 'nom', a_nom);
  end if;

  perform public.record_failed_attempt('agent', ident);
  return jsonb_build_object('ok', false, 'locked', false);
end;
$$;

-- ---------- DÉCLARATIONS (agent) ----------

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
  montant numeric(8,2);
begin
  if length(coalesce(p_description, '')) = 0 then
    return jsonb_build_object('error', 'description_requise');
  end if;

  select prime_config.montant into montant from public.prime_config where id = 1;

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
    coalesce(montant, 5),
    'soumise'
  );

  return jsonb_build_object('ok', true);
end;
$$;

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
           montant, statut, motif_refus, decided_by, decided_at, created_at
    from public.declarations
    where lower(agent_identifiant) = trim(lower(p_identifiant))
  ) t;

  return jsonb_build_object('ok', true, 'declarations', list);
end;
$$;

create or replace function public.get_prime_montant()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  montant numeric(8,2);
begin
  select prime_config.montant into montant from public.prime_config where id = 1;
  return jsonb_build_object('ok', true, 'montant', coalesce(montant, 5));
end;
$$;

-- ---------- DÉCLARATIONS (manager via Aeroteam, admin) ----------

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
             date_intervention, description, montant, statut, motif_refus,
             decided_by, decided_at, created_at
      from public.declarations
    ) t;
  else
    select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
    into list
    from (
      select id::text as id, agent_identifiant, agent_nom, avion, element,
             date_intervention, description, montant, statut, motif_refus,
             decided_by, decided_at, created_at
      from public.declarations
      where statut = p_statut
    ) t;
  end if;

  return jsonb_build_object('ok', true, 'declarations', list);
end;
$$;

create or replace function public.admin_validate_declaration(
  p_admin_code text,
  p_id uuid
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

  update public.declarations
  set statut = 'validee', decided_at = now(), decided_by = 'admin', motif_refus = ''
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

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
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  if length(coalesce(p_motif, '')) = 0 then
    return jsonb_build_object('error', 'motif_requis');
  end if;

  update public.declarations
  set statut = 'refusee', motif_refus = trim(p_motif), decided_at = now(), decided_by = 'admin'
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_prime_montant(
  p_admin_code text,
  p_montant numeric
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

  if p_montant is null or p_montant <= 0 then
    return jsonb_build_object('error', 'montant_invalide');
  end if;

  update public.prime_config set montant = p_montant where id = 1;

  return jsonb_build_object('ok', true);
end;
$$;