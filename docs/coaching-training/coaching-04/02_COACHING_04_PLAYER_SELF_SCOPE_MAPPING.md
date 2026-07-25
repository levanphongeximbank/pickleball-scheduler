# COACHING-04 — PLAYER Self-Scope Mapping

## Verdict

**`COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED`**

**Certification (2026-07-25 independent audit):**
**`COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED_NO_STAGING_GO`**

Full blocker certification:
[`06_COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKER_CERTIFICATION.md`](./06_COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKER_CERTIFICATION.md)

PLAYER self-scoped Coaching RLS, permission grants, and SQL mapping helpers remain **out of scope for apply**. Do not seed PLAYER Coaching permissions. Do not author `auth.uid()` → `player_id` helpers that invent or reuse unverified mappings.

---

## Evidence (why blocked)

| Claim sometimes assumed | Audit reality |
|-------------------------|---------------|
| `auth.uid() = player_id` | **False / unproven.** Coaching stores typed `player_id` from Player Management. JWT actor is an auth UUID. Equality is not a Coaching SoT. |
| `profiles.player_id` is Coaching SoT | **Rejected.** Alias: nullable, no FK, historically not UNIQUE; JS outcomes MAPPED/DERIVED/UNMAPPED/INVALID/AMBIGUOUS. |
| `profiles.id = auth.uid()` | **Identity principal only** — not Coaching `player_id`. |
| `team_tournament_user_player_id()` | **Rejected.** Module-scoped thin alias read; not Coaching RLS contract. |
| Rating V5 `auth.uid() = player_id` | **Rejected.** Different ID space (`profiles.id` UUID). |
| `resolveByAuthUser` / `resolveCanonicalPlayerId` | **App-layer only** — multi-outcome; not SECURITY DEFINER Coaching SoT. |
| `club_members` / `athletes` | Membership/athlete edges; **no** Coaching `player_id` principal binding. |
| `player-auth-{userId}` derivation | Convention elsewhere; **not** adopted as Coaching RLS SoT; silent create forbidden. |
| COACHING-02 / -03 already map PLAYER | Explicitly deferred: zero PLAYER Coaching grants; no PLAYER policies. |
| Phase 28 `coaching_students` | Prototype; not canonical. |
| Legacy LS `students[]` | Compatibility-only; no JWT binding. |

Therefore: **`auth.uid() ≠ player_id` unless a future Owner-approved SoT proves otherwise.**

---

## Missing source of truth (required before unblock)

See certification §7. Minimum:

1. Canonical SQL function/view: authenticated principal → Coaching `player_id` for `(tenant_id, club_id)`.
2. Explicit UNMAPPED / INVALID / AMBIGUOUS fail-closed (no silent backfill).
3. Multi-player-id-per-auth policy.
4. Positive self-read + negative cross-player SQL fixtures.
5. Owner-approved permission ids (e.g. future `coaching.self.read`) distinct from admin `coaching.records.read`.

Until those exist, any PLAYER policy would be a security fiction.

---

## Intended future self-scope rules (documentation only — NOT authored as grants/SQL)

When mapping is proven, intended rules (non-binding until a later pack):

| Surface | Future rule (sketch) |
|---------|----------------------|
| Enrollments | SELECT own rows where `player_id = mapped_player_id()` |
| Sessions | SELECT sessions linked to own enrollments / attendance |
| Attendance | SELECT own attendance; no INSERT of others |
| Evaluations | SELECT submitted evaluations for self; no draft of other players |
| Entitlements / usage | SELECT own entitlements and usage events |
| Programs / packages | SELECT definitions needed for own enrollments only |
| Coach references / relationships | SELECT only rows that reference self as player |
| Corrections | SELECT corrections for own attendance only |
| Mutations | Prefer RPC with mapped player check; no club-wide write |

**This pack does not implement the above.** No `coaching_04_mapped_player_id()` (or similar) appears in `10_*` / `20_*` / `30_*` / `40_*` by design.

---

## Explicit non-actions this step

1. No PLAYER rows in `40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql` grants.
2. No PLAYER policies in `20_COACHING_04_ASSIGNMENT_RLS.sql`.
3. No PLAYER helpers in `10_COACHING_04_ASSIGNMENT_HELPERS.sql` (commented absence).
4. Do not reuse or GRANT based on inventing `profiles.player_id` equality inside Coaching SQL.
5. UI PLAYER pages (`/coaching/coach-list`, `/coaching/register`) remain legacy/unavailable for durable self-scope until mapping unblocks.
6. Independent audit (2026-07-25) certifies blocker; Staging GO still withheld.

---

## Cross-references

- Blocker certification: `06_COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKER_CERTIFICATION.md`
- Staging evidence: `evidence/PLAYER_MAPPING_OFFLINE.json`, `evidence/PLAYER_MAPPING_LIVE_READONLY.json`
- Audit script: `scripts/coaching/coaching-04-player-mapping-audit.mjs`
- COACHING-03 deferral: `docs/coaching-training/coaching-03/02_COACHING_03_ROLE_PERMISSION_MATRIX.md`
- Coach assignment (proven path): `01_COACHING_04_ASSIGNMENT_MAPPING.md`
- Access matrix PLAYER column: `05_COACHING_04_ACCESS_MATRIX.md` → **blocked / N**
