# COACHING-04 — Scope & Security Model

**Workstream:** COACHING-04 — Assignment-aware RLS, PLAYER self-scope, scoped RPCs, durable runtime cutover authoring
**Package path:** `docs/coaching-training/coaching-04/`
**Status:** AUTHORED ONLY — do not apply SQL; do not flip runtime defaults; do not retire localStorage
**Depends on:** COACHING-01…03, **PM-ID-01 Staging-ready** (`player_identity_resolve_mapping` / `player_identity_is_mapped`)

**Owner GO for Staging apply (not granted):** `COACHING_04_OWNER_GO_APPLY_STAGING`

---

## Verdict markers

| Marker | Meaning in this pack |
|--------|----------------------|
| `COACHING_04_ASSIGNMENT_MODEL_PROVEN` | Coach JWT → `coach_principal_id` → active `coach_reference_id` binding is defined and enforceable |
| `COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO` | PLAYER self-scope SQL/runtime authored on PM-ID-01; Staging apply still Owner-gated |
| `COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED` | **Historical** (pre PM-ID-01) — see `06_*` certification |
| `COACHING_DURABLE_RUNTIME_DEFAULT=false` | Durable runtime remains off until separate activation GO |
| `LOCALSTORAGE_RETIRED=false` | Legacy store is not deleted; retirement is plan-only |
| `ADMIN_GRANTS_NOT_NARROWED` | COACHING-02 admin policies remain; COACHING-04 policies are additive (OR) |

---

## In scope (this authoring step)

1. Coach assignment model (helpers + RLS + RPCs) — retained from prior pack.
2. PLAYER self-scope **authoring** consuming PM-ID-01 (helpers + SELECT RLS + `coaching.self.read`).
3. Durable runtime integration / readiness contract (default still false).
4. localStorage isolation + retirement plan (no deletion).
5. Access matrix for all 13 Coaching tables.
6. Deterministic SQL manifest, rollback (manual), verification (read-only), Staging read-only preflight.

---

## Out of scope / forbidden

| Item | Rule |
|------|------|
| Apply any SQL (local / Staging / Production) | Forbidden without `COACHING_04_OWNER_GO_APPLY_STAGING` |
| Create mapping rows / backfill | Forbidden |
| Flip `COACHING_DURABLE_RUNTIME_DEFAULT` to true | Forbidden in this PR |
| Set `LOCALSTORAGE_RETIRED=true` / delete LS keys | Forbidden |
| Silent durable↔legacy fallback | Forbidden |
| Grant `coaching.records.read` to COACH or PLAYER | Forbidden |
| PLAYER mutation policies | Not authorized — read-only self-scope only |
| Production deploy / merge as apply authority | Forbidden |

---

## Security model (summary)

### Actors

| Actor | Binding |
|-------|---------|
| Admin | COACHING-02 permission + tenant/club scope |
| COACH | Active `coach_reference_id` where `coach_principal_id = auth.uid()::text` + assignment relationships + `coaching.assigned.*` |
| PLAYER | PM-ID-01 `MAPPED` canonical `player_id` for JWT venue/club + `coaching.self.read` — **own rows only** |
| SUPER_ADMIN | Reuses `coaching_02_has_action` / Identity permission system (no ad-hoc bypass) |

### PLAYER self-scope rules

1. Principal always from `auth.uid()` (via PM-ID-01).
2. No caller-supplied `principal_id` / `player_id` identity.
3. Mapping must be MAPPED + ACTIVE membership + correct tenant/club.
4. UNMAPPED / INACTIVE / AMBIGUOUS / INVALID → fail closed.
5. No expansion to other players in the same club.

### Permission convention

- COACH: `coaching.assigned.*` (five ids)
- PLAYER: `coaching.self.read` only
- Admin: existing COACHING-02 catalog

### RLS composition

Postgres ORs policies. Additive names: `coaching_04_*` (coach) and `coaching_04_player_*` (player). No `USING (true)` / `WITH CHECK (true)`. No anon. No client DELETE.

---

## Package table of contents

| File | Purpose |
|------|---------|
| `00_…` | This document |
| `01_…` | Coach assignment mapping |
| `02_…` | PLAYER self-scope mapping (PM-ID-01 consumer) |
| `03_…` | UI cutover plan |
| `04_…` | localStorage retirement plan |
| `05_…` | Access matrix |
| `06_…` | Historical blocker certification |
| `10_…` | Coach assignment helpers |
| `11_…` | PLAYER self-scope helpers |
| `20_…` | Coach assignment RLS |
| `21_…` | PLAYER self-scope RLS |
| `30_…` | Coach scoped RPCs |
| `40_…` | Permission seed + grants (PROPOSAL) |
| `90_…` | Rollback (manual only) |
| `99_…` | Verification (read-only) |
| `sql-migration-manifest.json` | Deterministic forward order |

---

## Entry conditions before Staging apply (future Owner gate)

1. PM-ID-01 Staging verified (done for mapping contract).
2. COACHING-02 tables + helpers + base RLS present (or COACHING-03 certified).
3. Owner grants `COACHING_04_OWNER_GO_APPLY_STAGING`.
4. Forward apply per `sql-migration-manifest.json` (rollback never auto-run).
5. Runtime default remains false until a **separate** durable activation GO.
