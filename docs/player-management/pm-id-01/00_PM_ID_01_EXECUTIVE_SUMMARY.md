# PM-ID-01 — Executive Summary

**Workstream:** Canonical Principal-to-Player Mapping Contract  
**Primary owner:** 2.5 Player Management  
**Supporting boundary:** Platform Identity (consumed, not modified)  
**First consumer:** 2.12 Coaching & Training — COACHING-04  
**Status:** AUTHORED ONLY — Staging SQL apply requires separate Owner GO  
**Owner GO token required for apply:** `PM_ID_01_OWNER_GO_APPLY_STAGING` (not granted in this step)

---

## Verdict of this package

Player Management authors a **dedicated additive SQL mapping SoT** named `public.player_identity_links` plus fail-closed resolution helpers/RPCs and a Player-owned JavaScript contract.

This package:

- does **not** treat `auth.uid()` as equal to canonical `player_id`;
- does **not** treat `profiles.player_id` as Coaching/RLS SoT;
- does **not** invent DERIVED / name / email / phone heuristics for mapping;
- does **not** apply SQL to Staging or Production;
- does **not** run backfill;
- does **not** grant `coaching.self.read` or author Coaching PLAYER RLS;
- does **not** unblock COACHING-04 PLAYER self-scope until Staging apply + Owner acceptance.

---

## Mapping result statuses (exact)

| Status | Meaning | `playerId` returned? |
|--------|---------|----------------------|
| `MAPPED` | Exactly one ACTIVE link; player id valid; membership active | Yes |
| `UNMAPPED` | No candidate link for principal × tenant × club | No |
| `INACTIVE` | Only REVOKED / inactive link and/or inactive membership | No |
| `AMBIGUOUS` | Multiple ACTIVE candidates (invariant breach or race) | No |
| `INVALID` | Unauthenticated, broken refs, tenant/club mismatch, inconsistent data | No |

---

## Canonical object

| Item | Value |
|------|-------|
| Table | `public.player_identity_links` |
| Canonical `player_id` DB type | **`text`** (not uuid) |
| Principal | `auth.users.id` / `auth.uid()` / `profiles.id` (**uuid**) |
| Scope keys | `tenant_id text`, `club_id text` |
| Lifecycle | `ACTIVE`, `REVOKED` |

---

## Safety markers (this step)

| Marker | Value |
|--------|-------|
| `databaseWrites` | `0` |
| `sqlApplied` | `false` |
| `mappingRowsCreated` | `0` |
| `backfillExecuted` | `false` |
| `roleGrantsApplied` | `false` |
| `productionTouched` | `false` |
| `filesDeleted` | `false` |
| `CODEX_DELETE_ALLOWED` | `NO` |

---

## Package layout

| File | Role |
|------|------|
| `01_PM_ID_01_SOURCE_OF_TRUTH_AUDIT.md` | SoT classification |
| `02_PM_ID_01_CANONICAL_MAPPING_CONTRACT.md` | Resolution contract |
| `03_PM_ID_01_SECURITY_AND_TENANT_MODEL.md` | RLS / admin / permissions |
| `04_PM_ID_01_BACKFILL_AND_AMBIGUITY_POLICY.md` | Backfill design only |
| `05_PM_ID_01_COACHING_CONSUMER_HANDOFF.md` | COACHING-04 handoff |
| `10_PM_ID_01_MAPPING_TABLE.sql` | Table DDL |
| `20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql` | Uniqueness + indexes |
| `30_PM_ID_01_RESOLUTION_HELPERS.sql` | Resolve + RLS boolean |
| `40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql` | Admin upsert/revoke |
| `50_PM_ID_01_RLS_AND_GRANTS.sql` | RLS + grants |
| `90_PM_ID_01_ROLLBACK.sql` | Drop PM-ID-01 objects only |
| `99_PM_ID_01_VERIFICATION.sql` | Post-apply verification (read-style) |
| `activation/` | Guarded Staging activation package (runbook, manifest, evidence) — apply still requires Owner GO |

---

## Runtime (Player-owned)

Public import: `src/features/player`

Primary method:

```js
resolveAuthenticatedCanonicalPlayerMapping({ tenantId, clubId })
```

Does **not** accept `principalId` / `playerId` / `authUserId` from callers to select identity.
