# Phase 1E — Production Closure Evidence

**Final verdict:** `PHASE_1E_PRODUCTION_CLOSED`  
**Closure date:** 2026-07-19 (UTC+7)  
**Environment:** Production Supabase only  
**Project ref:** `expuvcohlcjzvrrauvud`  
**Docs branch (this package):** `docs/player-phase-1e-production-closure`  
**origin/main SHA at closure authoring:** `66d1a259b08abe6bab2976e001dcc87abd551965`  
**origin/main SHA at Gate E apply:** `eeddb22fe04fea85d6c34b766a9236ddce221d73`

---

## 1. Scope

Phase 1E executed Owner-gated Production rollout of the frozen Phase 1D player profile migration:

- read-only Production preflight (Gate A);
- Free-plan logical backup policy + CSV evidence (Gate B);
- migration artifact freeze (Gate C);
- Owner approval package + `APPROVE_GATE_E` (Gate D → E);
- Production forward SQL apply + verify (Gate E);
- authenticated runtime smoke (Gate G);
- observation window (Gate H);
- this closure package (Gate I closure evidence).

**Out of scope / not performed in closure:**

- Phase 1F (not started);
- rollback SQL (not executed);
- frontend / Vercel deployment;
- Competition / Club / Venue / Notification / Finance / Ranking / Team Tournament changes;
- further Production mutation after Gate E.

---

## 2. Gate outcomes

| Gate | Result | Notes |
|------|--------|-------|
| **A** | **PASS** | Official read-only preflight completed. Pre-apply classification: `BLOCKED_UNSAFE` (expected — missing Phase 1D columns + legacy unsafe guard). |
| **B** | **PASS** | Under Owner-approved Free-plan logical-backup policy (Scheduled Backups/PITR unavailable by design). |
| **C** | **PASS** | Forward/verify/rollback reviewed; forward checksum frozen. |
| **D** | **COMPLETED** | Owner decision package prepared; Owner chose `APPROVE_GATE_E`. |
| **E** | **PASS** | Forward SQL applied on Production; verify passed; preflight → `ALREADY_READY`. |
| **F** | **PASS** (with E) | Immediate verify + official preflight re-run covered in Gate E. |
| **G** | **PASS** | Authenticated PLAYER smoke; self demographics OK; self verification blocked; restore completed. |
| **H** | **PASS** | ~71-minute quiet observation; 61 rows stable; no material regression. |
| **I (rollback)** | **NOT EXECUTED** | No incident; rollback not required. |
| **I (closure)** | **THIS DOCUMENT** | Production closure evidence finalized. |

Confirmed stable state after Gates E–H:

- 61 `public.profiles` rows stable;
- no material runtime regression;
- no unexpected mutation;
- no rollback;
- no deployment;
- Phase 1F not started.

---

## 3. Migration artifact and checksum

| Field | Value |
|-------|--------|
| Forward migration file | `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` |
| Frozen SHA-256 | `b4f98383c23f99686e7846faf2ae41bd54b46c5628dcb52b7452777401200b7f` |
| Verify SQL | `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql` |
| Rollback SQL (emergency only) | `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql` |
| Official preflight CLI | `node scripts/verify-phase-1e-player-profile-production-preflight.mjs` |

Checksum re-verified at closure authoring against the file on `origin/main` — **match**.

---

## 4. Backup policy and limitations

| Field | Value |
|-------|--------|
| Policy | Owner-approved **Free-plan logical backup** (CSV export of `public.profiles`) |
| Logical backup path | `C:\Users\Le Phong\Documents\PICK_VN_BACKUP\Player_Phase_1E\profiles_before_phase1e_gateE_2026-07-19.csv` |
| Outside Git | **Yes** (path is outside the repository root) |
| Tracked by Git | **No** |
| File evidence | Exists; 13,821 bytes; mtime `2026-07-19 21:45:34` (+07); **61** data rows; header includes `id`, `player_id`, `birth_year` |
| Scheduled Backups / PITR | **Unavailable by design** on Supabase Free during this phase |

### Limitations (recorded)

1. No PITR / no scheduled project backups — cannot restore to an arbitrary timestamp via platform Free plan.
2. CSV is table-scoped — recovers exported `public.profiles` content, not a full project restore.
3. Pre-migration shape only — export lacks Phase 1D columns (correct for pre-Gate E Production).
4. Rollback SQL ≠ restore — rollback drops Phase 1D columns and loses post-apply values; pre-apply recovery relies on this CSV (or re-export), not rollback alone.
5. Manual reload from CSV requires careful Owner-operated import and must not invent Phase 1D fields.

---

## 5. Production apply evidence (Gate E)

| Field | Value |
|-------|--------|
| Owner decision | `APPROVE_GATE_E` at `2026-07-19 22:03` (+07) |
| Apply window | ~`2026-07-19 22:03` (+07) / `15:03Z` |
| Apply duration | **~1 second** |
| Production project | `expuvcohlcjzvrrauvud` |
| SQL applied | **Only** `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` |
| Checksum at apply | Matched frozen `b4f98383…0b7f` |
| Pre-apply profile count | **61** |
| Rollback during apply | **No** |
| Deploy during apply | **No** |
| Post-apply official preflight | **`ALREADY_READY`** |

### Post-apply verification (Gate E / F)

| Check | Result |
|-------|--------|
| Required columns | Present: `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status`, `birth_year` |
| Constraints | 6/6 present |
| Partial index | `profiles_identity_verification_status_partial_idx` present |
| Guard | `profiles_guard_privileged_update` present; **no** `current_user='postgres'` bypass |
| Self verification block | Present |
| Trigger | `profiles_guard_privileged_update_trg` present |
| `privacy_null` | **0** |
| `verification_null` | **0** |

---

## 6. Runtime smoke evidence (Gate G)

| Field | Value |
|-------|--------|
| Verdict | **PASS** |
| Account | `player@gmail.com` — role **PLAYER** (non-admin) |
| Canonical resolution | Auth session uid matched profile; `player_id` resolved |
| Fields read | `birth_year`, `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status` |
| Write smoke field | `handedness` (`null` → temporary `left` → restored to canonical `unknown`) |
| Writer path | Official `updatePlayerProfile` / durable profiles writer (session JWT) |
| Self `identity_verification_status` write | **Blocked** — app `FORBIDDEN_FIELD`; direct DB raise `P0001`; status unchanged |
| Unrelated-row impact | **None** — 60 other rows fingerprint unchanged |
| Final preflight after smoke | **`ALREADY_READY`** |
| Schema SQL / rollback / deploy during G | **No** |

---

## 7. Observation evidence (Gate H)

| Field | Value |
|-------|--------|
| Verdict | **PASS** |
| Start | `2026-07-19 22:20:11` (+07) / `15:20:11Z` |
| End | `2026-07-19 23:30:56` (+07) / `16:30:56Z` |
| Duration | **~71 minutes** (preferred ≥60) |
| Profile read/write errors | None material |
| RLS / permission errors | None (`permission denied` / RLS hits = 0) |
| Guard / trigger errors in window | None (`profiles_guard_privileged_update` error hits = 0) |
| Unexpected mutation | **None** — fingerprint stable across baseline → mid → final |
| Row / null stability | `total=61`; `privacy_null=0`; `verification_null=0` |
| Final preflight | **`ALREADY_READY`** |
| Schema SQL / rollback / deploy during H | **No** |

---

## 8. Final schema / security state

| Area | Final state |
|------|-------------|
| Required columns | Present (`birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status`, `birth_year`) |
| Constraints | 6 Phase 1D CHECKs present |
| Partial index | `profiles_identity_verification_status_partial_idx` present |
| Guard | `profiles_guard_privileged_update` — hotfixed body; **no** `current_user='postgres'` bypass |
| Trigger | `profiles_guard_privileged_update_trg` present |
| Privacy null count | **0** |
| Verification null count | **0** |
| Official preflight classification | **`ALREADY_READY`** |
| Profile row count | **61** (stable) |

### RLS / grants

| Check | Status |
|-------|--------|
| RLS policies | **Unchanged** by Phase 1D/1E forward migration (no policy DDL in forward SQL) |
| Grants / revokes | **Unchanged** (no GRANT/REVOKE in forward SQL) |
| Preflight inventory flags | Match baseline / not flagged unsafe through Gates E–H |

---

## 9. Rollback warning

Rollback is **not** part of normal Phase 1E close-out and **was not executed**.

File: `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql`

Warnings:

- Rollback **drops** `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status` → **data loss** for post-apply values.
- Rollback is **not** a substitute for the logical CSV backup or platform restore.
- Rollback does **not** drop `birth_year` / `gender` / `player_id`.
- Execute only with separate Owner written approval after an incident that cannot be remediated forward.

---

## 10. Boundary confirmations

| Item | Status |
|------|--------|
| Rollback executed | **No** |
| Production deployment (frontend/Vercel) | **No** |
| Phase 1F started | **No** |
| Further Production SQL after Gate E | **No** |
| Closure modifies Production | **No** (docs-only) |

---

## 11. Final verdict

**`PHASE_1E_PRODUCTION_CLOSED`**

Player Management Phase 1E Production rollout is complete: migration applied, verified, smoke-tested, observed quiet, and closure evidence recorded. Production remains at official preflight classification **`ALREADY_READY`** with 61 stable profile rows.

---

## 12. Next-phase boundary

- **Do not** start Phase 1F from this closure package.
- **Do not** run rollback unless a separate Owner-approved Gate I incident appears.
- **Do not** treat this document as authorization to deploy or mutate Production further.
- Any later Player Management phase requires a **new** Owner decision and its own gates.

### Exact Owner action next

1. Review this closure document on branch `docs/player-phase-1e-production-closure`.
2. Open/merge the docs-only PR when ready (this authoring stop is **before** PR create/merge).
3. Keep Phase 1F blocked until explicitly approved.
