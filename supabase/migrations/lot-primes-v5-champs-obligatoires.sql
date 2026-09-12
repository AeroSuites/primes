-- ============================================================
-- AeroPrimes v5 — champs obligatoires à la déclaration
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
--
-- Le matricule avion et l'élément deviennent obligatoires
-- (la description l'était déjà). La date reste facultative.
-- ============================================================

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
  if length(trim(coalesce(p_avion, ''))) = 0 then
    return jsonb_build_object('error', 'avion_requis');
  end if;

  if length(trim(coalesce(p_element, ''))) = 0 then
    return jsonb_build_object('error', 'element_requis');
  end if;

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
    trim(p_avion),
    trim(p_element),
    p_date_intervention,
    p_description,
    null,
    'soumise',
    v_manager
  );

  return jsonb_build_object('ok', true);
end;
$$;
