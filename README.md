# AeroPrimes — Déclarations prime toilettes

Application web indépendante (connectée à Aeroteam) : les agents déclarent leurs interventions
sur éléments sales (toilettes…), le manager valide les demandes depuis l'Administration d'AeroTeam,
et l'agent suit ses déclarations et validations toute l'année.

## Fonctionnement

- **Agents** : compte propre (identifiant + mot de passe), créé dans cette application — ils
  n'utilisent pas AeroTeam.
- **Manager** : connecté à AeroTeam (code admin) → page Administration → section « Demandes de
  primes » : validation, refus avec motif, export Excel, montant unitaire configurable.
- Les données sont stockées dans le **même projet Supabase** qu'AeroTeam (tables `agents`,
  `declarations`, `prime_config`, accès exclusivement via RPC `SECURITY DEFINER`).

## Base de données

Exécuter une fois dans Supabase → SQL Editor : `supabase/migrations/lot-primes.sql`

## Démarrage local

```bash
npm install
```

Copier `.env.example` en `.env` avec les mêmes clés Supabase qu'AeroTeam, puis :

```bash
npm run dev
```

## Déploiement

Créer un dépôt GitHub `aeroteam-primes`, configurer les secrets `SUPABASE_URL` et
`SUPABASE_ANON_KEY`, pousser sur `main` — le workflow `.github/workflows/deploy.yml` publie sur
GitHub Pages (`https://VOTRE_COMPTE.github.io/aeroteam-primes/`).