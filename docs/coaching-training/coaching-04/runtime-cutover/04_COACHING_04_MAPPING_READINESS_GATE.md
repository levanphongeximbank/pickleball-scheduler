# COACHING-04 — Mapping Readiness Gate

**Certified Staging mapping rows:** `0`  
**Classification:** `COACHING_04_RUNTIME_CUTOVER_READY_WITH_PLAYER_UNMAPPED_GATE`

## Why not blocked?

| Path | Depends on mapping rows? | Behavior at mappingRows=0 |
|------|--------------------------|---------------------------|
| COACH / admin durable (`requirePlayerSelfScope=false`) | No | Assignment helpers / admin authz; independent |
| PLAYER durable (`requirePlayerSelfScope=true`) | Yes for LIVE | Fail-closed `UNMAPPED` — no fake LIVE data |

Zero mapping rows is intentional post-SQL certification evidence (`mappingRowsCreated=0`). PLAYER surfaces must show UNMAPPED, never invent rows.

## QA conditions before Staging durable activation

1. PR #292 Staging schema/RLS/RPC certified.
2. Helper ACL `0/0/12` holds.
3. No silent fallback tests green.
4. PLAYER UNMAPPED fail-closed tests green.
5. COACH durable scope tests green (may still note `coachRoleCount=0` deferred grants).
6. Owner GO `COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING` granted with exact commit binding.
7. Preview env Staging-only (never Production ref).

Optional later (not required for classification A): Owner-approved MAPPED fixture for positive PLAYER LIVE/EMPTY QA — **outside** this package; do not invent IDs here.

## Controlled QA mapping request package (optional future)

If Owner later requests a single MAPPED fixture for PLAYER LIVE QA, provide exact values only from Staging inventory. Repository does **not** contain a certified `(tenantId, clubId, authPrincipal, canonicalPlayerId)` tuple for this workstream; inventing IDs is forbidden.

**Blocker for optional LIVE PLAYER QA fixture (not for cutover classification A):**

```text
BLOCKER: exact_canonical_player_mapping_tuple_unavailable_in_repo
required_fields:
  - tenantId
  - clubId
  - auth principal (profiles.id / auth.uid())
  - canonical playerId (PM-ID-01 MAPPED)
validation:
  - PM-ID-01 resolveAuthenticatedCanonicalPlayerMapping → MAPPED
  - coaching_04_player_identity_is_mapped() true for that principal
rollback:
  - deactivate/delete mapping row under Owner GO only
  - never silent backfill
owner_go_required:
  - COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING (activation)
  - separate Owner approval for any mapping-row creation
```

## Explicit non-action

This package does **not** create mapping rows.
