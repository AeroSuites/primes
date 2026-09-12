-- ============================================================
-- AeroPrimes — correction : rattrapage de la v2 oubliée
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
--
-- La migration v2 n'avait pas été exécutée : la colonne categorie
-- manquait, ce qui faisait échouer la liste des demandes (v3).
-- ============================================================

-- 1) Colonne catégorie (choisie par le manager à la validation)
alter table public.declarations
  add column if not exists categorie text not null default '';

-- 2) L'agent voit la catégorie de ses déclarations validées
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
