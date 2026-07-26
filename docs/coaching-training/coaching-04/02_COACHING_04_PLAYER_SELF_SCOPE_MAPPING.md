# COACHING-04 — PLAYER Self-Scope Mapping

## Verdict

**`COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO`**

PM-ID-01 Canonical Principal-to-Player Mapping Contract is **Staging-ready** (applied + verified on `qyewbxjsiiyufanzcjcq`). COACHING-04 now **authors** PLAYER self-scope as a **consumer** of PM-ID-01.

This authoring PR does **not**:

- apply COACHING-04 SQL to Staging;
- flip `COACHING_DURABLE_RUNTIME_DEFAULT`;
- retire localStorage;
- create mapping rows / backfill;
- authorize PLAYER mutations.

Historical blocker certification (pre PM-ID-01) remains on record:
[`06_COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKER_CERTIFICATION.md`](./06_COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKER_CERTIFICATION.md)

---

## Canonical mapping (SoT)

| Layer | Object | Rule |
|-------|--------|------|
| SQL resolve | `public.player_identity_resolve_mapping(p_tenant_id, p_club_id)` | Principal from `auth.uid()` only |
| SQL boolean | `public.player_identity_is_mapped(p_tenant_id, p_club_id)` | `true` only when status = `MAPPED` |
| Coaching helper | `public.coaching_04_mapped_player_id()` | Uses PM-ID-01 + `user_venue_id()` / `user_club_id()` |
| Coaching boolean | `public.coaching_04_player_is_self(player_id)` | Exact equality to mapped id |
| JS resolver | `resolveAuthenticatedCanonicalPlayerMapping({ tenantId, clubId })` | No caller principal/player identity |

### Fail-closed statuses

| Status | Coaching behavior |
|--------|-------------------|
| `MAPPED` | Allow self-read when `coaching.self.read` granted |
| `UNMAPPED` | Deny |
| `INACTIVE` | Deny |
| `AMBIGUOUS` | Deny |
| `INVALID` | Deny |

### Forbidden identity sources

- `auth.uid() = player_id`
- `profiles.player_id`
- email / phone / display name / first row
- localStorage identity
- caller-supplied `principal_id` / `player_id`

---

## Authored SQL / grants

| File | Contents |
|------|----------|
| `11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql` | Mapping helpers (PM-ID-01 consumer) |
| `21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql` | Additive PLAYER SELECT policies |
| `40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql` | Seeds `coaching.self.read` + PLAYER grant |

PLAYER mutation policies are **not** authored — business contract remains **read-only**.

---

## Runtime contract

- Durable default remains `false`.
- PLAYER durable surfaces must classify: `LOADING` / `LIVE` / `EMPTY` / `UNMAPPED` / `FORBIDDEN` / `ERROR` (+ `INACTIVE` / `AMBIGUOUS` / `INVALID`).
- Durable failure must **not** silent-fallback to localStorage success.
- localStorage implementation remains (legacy isolation + telemetry); not retired.

---

## Cross-references

- PM-ID-01 handoff: `docs/player-management/pm-id-01/05_PM_ID_01_COACHING_CONSUMER_HANDOFF.md`
- Access matrix: `05_COACHING_04_ACCESS_MATRIX.md`
- Cutover plan: `03_COACHING_04_UI_CUTOVER_PLAN.md`
- Manifest: `sql-migration-manifest.json`
