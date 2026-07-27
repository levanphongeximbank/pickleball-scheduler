# Rollback & Operations

## Clubs / Courts Production remote

1. Set `VITE_PUBLIC_CLUBS_COURTS_SOURCE=local` (or unset) on Vercel Production
2. Redeploy
3. Portal returns to local EC-03 honest MIXED path

## Tournaments / Rankings remote (after optional Owner cutover)

1. Set `VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=local` (or unset)
2. Redeploy
3. Pages honor selector and return to local EC-04 honest path

## SQL rollback packages (reference only — not applied this run)

- Clubs/Courts: docs under `docs/public-catalog/pc-01/` and production-publication packages
- Tournaments/Rankings: `docs/public-catalog/pc-02/90_PUBLIC_CATALOG_02_ROLLBACK.sql`

## This certification run

- No Production SQL
- No data mutation
- No env mutation
- No deploy
