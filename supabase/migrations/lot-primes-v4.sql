-- ============================================================
-- AeroPrimes v4 — réaffecter un agent à un autre manager
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- (après lot-primes-v3.sql)
--
-- - chaque agent peut être rattaché / changé de manager
-- - les primes EN ATTENTE (soumises) suivent le nouveau manager
-- - l'historique validé / refusé reste avec l'ancien manager
-- ============================================================

-- 1) Liste des agents avec leur manager (pour l'affichage et la réaffectation)
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
           a.manager_id::text as manager_id,
           coalesce(m.name, '') as manager_nom,
           count(d.id) filter (where d.statut = 'soumise') as en_attente,
           count(d.id) filter (where d.statut = 'validee') as validees,
           count(d.id) as total
    from public.agents a
    left join public.admins m on m.id = a.manager_id
    left join public.declarations d
      on lower(d.agent_identifiant) = lower(a.identifiant)
    where a.manager_id is null
       or a.manager_id = v_admin_id
       or not exists (select 1 from public.admins x where x.id = a.manager_id)
    group by a.id, a.identifiant, a.nom, a.actif, a.created_at, a.manager_id, m.name
  ) t;

  return jsonb_build_object('ok', true, 'agents', list);
end;
$$;

-- 2) Rattacher / changer le manager d'un agent
create or replace function public.admin_set_agent_manager(
  p_admin_code text,
  p_identifiant text,
  p_manager_id uuid
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

  if p_manager_id is not null
     and not exists (select 1 from public.admins where id = p_manager_id) then
    return jsonb_build_object('error', 'manager_inconnu');
  end if;

  update public.agents a
  set manager_id = p_manager_id
  where lower(a.identifiant) = trim(lower(p_identifiant))
    and (a.manager_id is null
         or a.manager_id = v_admin_id
         or not exists (select 1 from public.admins x where x.id = a.manager_id));

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Les primes en attente suivent le nouveau manager
  update public.declarations d
  set manager_id = p_manager_id
  where lower(d.agent_identifiant) = trim(lower(p_identifiant))
    and d.statut = 'soumise';

  return jsonb_build_object('ok', true);
end;
$$;
