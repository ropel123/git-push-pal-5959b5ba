# HackAO

Plateforme SaaS pour PME/ETI françaises : veille des appels d'offres publics, analyse IA des DCE et rédaction de mémoires techniques.

## Stack

- **Frontend** : Vite + React + TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query
- **Backend** : Supabase (Postgres + RLS, Auth, Storage, Edge Functions Deno)
- **Paiements** : Stripe (Checkout + webhooks)
- **Hébergement** : Vercel (SPA — voir `vercel.json`)

## Développement local

```sh
npm install
npm run dev        # http://localhost:8080
```

Variables d'environnement (voir `.env`) :

```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

## Scripts

```sh
npm run dev        # serveur de dev (port 8080)
npm run build      # build de production → dist/
npm run preview    # sert le build localement
npm test           # tests unitaires (vitest)
npm run lint       # eslint
```

## Déploiement (Vercel)

Le projet est connecté à Vercel : chaque push sur `main` déclenche un déploiement.
`vercel.json` configure le build Vite (`dist/`) et la réécriture SPA (toutes les routes → `index.html`).

Renseigner les variables `VITE_*` dans les settings du projet Vercel (Production + Preview).

## Backend Supabase

- `supabase/functions/` — edge functions (ingestion BOAMP/TED, analyse de DCE, génération de mémoires, Stripe…)
- `supabase/migrations/` — migrations SQL
- Les appels LLM passent par `supabase/functions/_shared/aiGateway.ts` — voir `docs/architecture/strategie-ia.md`

## CI

`.github/workflows/ci.yml` : typecheck + tests + build sur chaque push/PR vers `main`.
