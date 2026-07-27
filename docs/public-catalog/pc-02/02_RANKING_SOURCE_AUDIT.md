# PUBLIC-CATALOG-02 — Ranking Source Audit

## Finding

Canonical VPR leaderboard exists on **Production**:

- Table: `vpr_leaderboard` (0 rows)
- RPC: `vpr_list_public_leaderboard`

Staging does **not** have VPR tables. Portal local path still uses VPR flag / mock-honest EC-04 path.

Player Rating history and competition standings are **not** public Ranking sources.

## Classification

**`PROJECTION_REQUIRED`**

Resolved by PC-02 dedicated projection (Staging parity + PC-01 security model):

- Table: `public.public_catalog_rankings`
- RPC: `public.public_catalog_list_rankings(p_limit, p_offset, p_sort, p_category)`
- Deny-by-default publication
- Empty projection ⇒ LIVE + EMPTY (valid)

## Hard rules enforced

- Ranking LIVE must come from Ranking authority / certified public ranking projection.
- Do not invent ranking calculation in Experience Channels.
- Do not publish phone/email/member IDs/rating adjustment history/tenant writer metadata.
- Display name must be a public-safe certified projection field only.

## Note on VPR

PC-02 does **not** open anon SELECT on `vpr_leaderboard`. Future certified publication may project selected VPR rows into `public_catalog_rankings` via a separate Owner-approved publication package — not this workstream’s writer scope.
