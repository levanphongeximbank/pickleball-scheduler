# RATING-V5-CUTOVER-01 — Published Rating Authority Readiness Audit

| Field | Value |
|-------|-------|
| Workstream | `RATING-V5-CUTOVER-01` |
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\rating\rating-v5-published-authority-readiness` |
| Branch | `audit/rating-v5-published-authority-readiness` |
| Mode | **Read-only audit** — no cutover, no code/test/SQL/flag/env mutation |
| Audit date | 2026-08-05 |
| Production mutation | **NONE** (this workstream) |

---

## Executive verdict

**V5 is NOT ready to become Production published authority.**

| Claim | Status |
|-------|--------|
| Current published skill SSOT | **V2** `pick_vn_player_ratings.current_rating` (+ club blob / local mirrors) |
| V5 role today | **Shadow / durable target** — pilot-gated, mostly `is_shadow=true` |
| Architecture SSOT (BM-FINAL) | V5 tables via `player-rating/foundation` — **not** Production cutover |
| Deferred gate | `PLAYER_RATING_PRODUCTION_CUTOVER` still open |
| This audit | Decision package only — **no cutover authorization** |

```text
CLASSIFICATION: NOT_READY_FOR_PUBLISHED_AUTHORITY_CUTOVER
PRODUCTION_MUTATION_STATUS: UNTOUCHED
```

---

## 1. Final classification

| Dimension | Classification |
|-----------|----------------|
| Published runtime authority | `V2_PUBLISHED` |
| V5 runtime role | `V5_SHADOW_DURABLE_TARGET` |
| Foundation role | `CANONICAL_DOMAIN_BOUNDARY` (architecture; fail-closed CAS) |
| Competition Elo | `INTERNAL_SIGNAL_NOT_PUBLIC` |
| Club blob / local store | `COMPATIBILITY_MIRROR` |
| VPR | `SEPARATE_RANKING_DOMAIN` |
| Cutover readiness | `NOT_READY` |
| Evidence completeness for Production cutover | `INSUFFICIENT` (no full V2↔V5 population reconciliation; readers still V2-first) |

---

## 2. Current published SSOT

**Published skill rating SSOT (product readers today):**

```text
pick_vn_player_ratings.current_rating
  + club_data_v3 players[].current_rating / skillLevel / level / rating mirrors
  + local key pickleball-pick-vn-ratings-v1 (hydrate cache)
```

Evidence:

| Source | Path |
|--------|------|
| Schema | `docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql` |
| Shadow design | `docs/v5/rating-v5/V5-A1_SHADOW_MODE.md` — “V2 = production canonical” |
| Coexistence ADR | `docs/v5/rating-v5/adr/ADR-005-v2-coexistence.md` |
| Pairing resolver | `src/features/pairing-candidates/canonicalAthleteRating.js` — V2-first, **no V5** |
| Player helpers | `src/models/player.js` — `getPlayerCurrentRating` / blob mirrors |
| Spec | `docs/v5/PICK_VN_RATING_SPEC.md` |

**Architectural writable SSOT (not Production cutover):** V5 durable tables via `src/features/player-rating/foundation/**` — `docs/player-rating/bm-final-rating-01/01_CANONICAL_SSOT_DECISION.md`. Explicit non-claims: flag not enabled as Production cutover; `PLAYER_RATING_PRODUCTION_CUTOVER` deferred.

**Scale conflict (blocker for naive migration):**

| Scale | Range | Status |
|-------|-------|--------|
| V2 Pick_VN | 1.0–8.0 | Live published / pairing |
| V5 target | 1.5–6.0 | Target contract; Phase 1A forbids conversion formulas |

---

## 3. V5 current role

| Aspect | Role today |
|--------|------------|
| Storage | 9 foundation tables (`player_rating_profiles`, events, snapshots, assessments, evidence, review, calibration, rollout_config, idempotency) |
| Default | `player_rating_profiles.is_shadow = true` — excluded from leaderboard index |
| Writes | Edge `rating-v5-complete-assessment` → service_role `rating_v5_service_persist_assessment_completion` |
| AuthZ | `rating_v5_pilot_enrollments` + `rating_v5_rollout_config` + `VITE_PICK_VN_RATING_V5_ENABLED` |
| Browser CAS | **Unavailable** — `clientGeneralCasRpcAvailable: false`, `productionCutover: false` in `v5DurableRuntime.js` |
| Read facade | Collects candidates; **not wired** as product published reader |
| Compare | Side-by-side only (`V5InternalComparePanel`) — no write-back to V2 |
| Production pilot | Wave A = **5 users** only; expand forbidden without Owner GO (`V5-P1C_FINAL_VERDICT.md`) |

---

## 4. Writer matrix

### 4.1 Authority map (component matrix)

| component | file/path | table/RPC/service | R/W | current authority | fallback | rollout gate | conflict risk | required cutover action |
|-----------|-----------|-------------------|-----|-------------------|----------|--------------|---------------|-------------------------|
| V2 published row | `PHASE_30` / `PHASE_31` SQL | `pick_vn_player_ratings` / `pick_vn_sync_rating` | W | **Published SSOT** | — | none (live RPC) | **Critical** — client-trusted upsert | Freeze RPC writes before canary; later revoke |
| V2 RPC wrapper | `pickVnRatingRpcService.js` | `rpcPickVnSyncRating` | W callable | Still callable | — | none | High | Keep for admin/ops only or revoke after freeze |
| V2 app writers | `pickVnRatingService.js`, `ratingVerificationService.js`, `ratingProposalService.js` | facade / frozen | W frozen | BM-FINAL freeze | facade fail-closed | CI ownership rules | Med if bypass | Keep frozen; audit residual call sites |
| Club blob mirror write | `skillLevelChangeService.js`, `models/player.js` | `club_data_v3` players[] | W mirror | Not SSOT but **published-facing** | 3.5 defaults | none | **Critical** | Demote to read-only mirror under cutover |
| Club hydrate | `pickVnClubSyncService.js` | V2 RPC → blob/local | R + mirror W | `canonicalAuthority: false` | skip on fail | none | High | Redirect hydrate to V5 after canary |
| Local V2 store | `pickVnRatingLocalStore.js` | `pickleball-pick-vn-ratings-v1` | R/W cache | Mirror | — | none | Med | Draft/cache only; no authority |
| V2 assessment draft | `playerRatingAssessmentLocalStore` / onboarding | local | Draft | Draft-only | — | none | Med | Keep draft; never promote to V2 during freeze |
| V5 assessment persist | Edge + `PHASE_V5B1P` | `rating_v5_service_persist_assessment_completion` | W durable | Shadow profiles | pilot deny | flag + rollout + enrollment | Low vs V2 (isolated) | Promote `is_shadow=false` only with Owner GO |
| V5 profile upsert | `PHASE_V5A` | `rating_v5_service_upsert_profile` | W service | Shadow | — | service_role | Med | Migration + recompute path |
| V5 recompute | `PHASE_V5C1` | `rating_v5_recompute_shadow_profile` | W shadow | Shadow | — | service_role | Low | Ops tool |
| V5 pilot enroll | `PHASE_V5C1` | `rating_v5_admin_upsert_pilot_enrollment` | W authZ | Enrollment SOT | deny | Owner GO | Low | Expand cohort only with GO |
| Foundation write facade | `composePlayerRatingWriteFacade.js` | ports → V5 runtime | W fail-closed | Target | unavailable → error | CAS runtime missing | High if forced | Inject CAS runtime before published writes |
| Competition Elo | `ratingServiceV2.js`, `eloService.js`, `eloEngine.js` | blob + optional CC RPC | W Elo | Internal | skill→Elo map | `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | **Critical if conflated** | Keep separate; never publish as skill |
| Club Elo | `clubEloService.js` | club extension | W Elo | Club-scoped | DEFAULT_CLUB_ELO | — | Med | Keep separate |
| Events immutability trigger | `PHASE_V5A` | `trg_rating_v5_events_no_update` | deny U/D | Ledger | — | — | None | Keep |
| Seed fixtures | `scripts/seed-tt-*.mjs` | admin upsert V2 | W | Test/staging | — | scripts | Med | Ban on Production cutover path |
| Monthly skill proposals | `skillLevelEngine.js` | proposals + public lock | W proposals / blob | Legacy public path | — | — | High | Freeze public apply; migrate to foundation |

### 4.2 Writer freeze categories (design only — not applied)

| Category | Writers |
|----------|---------|
| **Must freeze before cutover** | `pick_vn_sync_rating` Production grants; blob `current_rating` independent writes (`skillLevelChangeService`, Elo mirror-to-public); monthly public skill lock apply; fire-and-forget V2 sync; seed scripts on Production |
| **May stay internal-only** | Competition Elo apply; Club Elo; V5 shadow assessment; V5InternalCompare; foundation draft assessment |
| **Need migration** | Existing V2 `current_rating` rows → V5 profiles; blob mirrors → rehydrate from V5; pairing/selectors/helpers |
| **Delete after stabilization** | V2 reader fallbacks in `canonicalAthleteRating`; local V2 as authority; legacy `getPlayerCurrentRating` blob precedence; eventually `pick_vn_sync_rating` |

---

## 5. Consumer matrix

| consumer | reads today | fallback | published? | cutover to V5? | regression risk |
|----------|-------------|----------|------------|----------------|-----------------|
| Athlete self profile / Skill overview | V2 local (`AthleteRatingSummary`) | UNRATED CTA | Yes (self) | **Yes** | High |
| PlayerProfile + PickVnRatingPanel | Blob + V2 local | 3.5 / hide | Yes (gated) | **Yes** | High |
| Public player directory | Rating stripped | n/a | No skill | No | Low |
| Roster PlayerCard / Players | Blob level/`current_rating` | “Chưa đánh giá” / 3.5 | Yes | **Yes** | High |
| Pairing `canonicalAthleteRating` | V2 current→prov→self→legacy | NONE | Internal authority | **Yes** | **Critical** |
| Select-players adapter | Supabase V2 rows | legacy member | Internal | **Yes** | **Critical** |
| Private pairing policy | Blob rating/level/skill | 3.5 or exclude | Internal | **Yes** | **Critical** |
| Court AI scoring/pairing | Blob `level` | 0 / policy | Internal | **Yes** | High |
| AI assistant pairing/seed | elo / skill×200 | 3.5×200 | Internal | **Yes** | High |
| Tournament seeding | Snapshot V5 optional → elo → skill | defaults | Internal | Partial → full | High |
| Eligibility engines | `getPlayerRatingInternal` / V5 snapshot | 3.5 | Internal | **Yes** | High |
| Team roster hydration | Canonical V2/legacy fields | null | Internal | **Yes** | High |
| Season leaderboard CSV | Blob `rating`/`level` labeled “Elo” | blank | Published export | Clarify + migrate if skill | Med |
| Club Ratings tab | Club Elo (+ optional level) | DEFAULT | Club | Optional separate | Med |
| VPR / RankingsPage | VPR points | mock/flag | Ranking domain | **No** | Low |
| Admin users (identity) | No skill | — | No | No | Low |
| Skill level requests / SkillLevelsPage | V2 scale / ratingInternal | — | Admin | **Yes** | High |
| Assessment V2 onboarding | Produces V2 path | — | Self | Migrate write | High |
| Assessment V5 workspace | V5 (+ V2 compare) | flag/pilot block | Pilot | Already V5 | Med |
| Club membership / governance | V2 local/RPC → blob stamp | **3.5** | Club surfaces | **Yes** | **Critical** |
| Account-only athlete hydrate | V2 local → RPC | UNRATED | Hydration | **Yes** | High |
| Notifications | No skill payload found | — | n/a | No | None found |
| Reports/exports (season) | Blob rating | blank | Export | Yes if skill | Med |
| API playersHandler | Blob `skillLevel` | — | API | **Yes** | Med |
| Mobile/PWA module | No direct rating reads | inherits shared pages | Indirect | Same as shared | Med |
| Director scoreboard | No skill reads | — | Ops | No direct | Low |
| Tournament registration panels | `getPlayerCurrentRating` | gender-only | Organizer | **Yes** | High |
| Foundation read facade | V2+V5 overview | empty/partial | **Tests only** | Target published API | Low today / High when adopted |

---

## 6. Conflict pairs

| # | Pair | Conflict | Severity |
|---|------|----------|----------|
| C1 | V2 `current_rating` vs V5 `display_rating` | Dual authorities; product reads V2 only | **P0** |
| C2 | V2 scale 1–8 vs V5 scale 1.5–6 | No approved conversion formula (Phase 1A freeze) | **P0** |
| C3 | Blob mirror writes vs “blob not SSOT” | `skillLevelChangeService` / Elo engines still mutate published-facing fields | **P0** |
| C4 | `pick_vn_sync_rating` still live vs app writer freeze | DB RPC remains client-trusted path | **P0** |
| C5 | Competition Elo ↔ skill mapping vs public skill | Engines map Elo↔skill; risk of publishing Elo-derived skill | **P1** |
| C6 | Pairing V2-first vs seeding optional V5 snapshot | Same athlete can get different skill signals by surface | **P1** |
| C7 | Architecture SSOT (V5) vs runtime SSOT (V2) | Docs say both for different claims — easy mis-cutover | **P1** |
| C8 | Pilot enrollment missing vs expected deny | Missing enrollment is **expected** deny state — not data bug | Info |
| C9 | `auth_user_id` (V2) vs V5 `player_id` (= `auth.uid()` / profiles.id) vs blob player ids | Alias resolution incomplete for full population | **P1** |
| C10 | Wave A cohort label vs rollout `pilot_cohort_label` | Historical misalignment risk (docs note separate labels) | **P2** |
| C11 | Foundation CAS unavailable vs “canonical write” | Published writes cannot go through foundation without runtime | **P0** for cutover |
| C12 | Season CSV “Elo” label vs blob skill fields | Mislabel / mixed signal in exports | **P2** |

---

## 7. V5 eligibility matrix

| Check | Evidence | Result |
|-------|----------|--------|
| Pilot enrollment SOT | `rating_v5_pilot_enrollments` + `isPilotEnrollmentActive` | **PASS** (design + code) |
| Missing enrollment expected? | Deny `PILOT_NOT_ENROLLED` / UI block | **Yes — expected** |
| Profile creation | Service upsert / assessment completion; RLS denies client direct write | **PASS** (server path) |
| `auth.uid` / `player_id` mapping | V5 uses `auth.uid()` as player_id; V2 uses `auth_user_id`; text `profiles.player_id` alias | **PARTIAL** — pilot Wave A linked; **full-pop unproven** |
| Tenant rules | `rating_v5_resolve_tenant_id` / venue; Wave A `venue-prod-main` | **PASS** for Wave A; venue_id null caused past UI false deny (fixed for 5) |
| Rollout flags | `rating_v5_rollout_config` + `VITE_PICK_VN_RATING_V5_ENABLED` | Gate chain exists; Production flag enablement = deferred gate |
| RLS/RPC | Authenticated cannot write profiles; service persist; pilot RPCs | Staging/prod pilot evidence present; **full cutover RLS not re-verified in this audit** |
| Shadow completeness | Default `is_shadow=true`; leaderboard excludes shadow | Expected for shadow era |
| Invalidated profiles | Invalidate RPCs exist (PHASE_V5C1) | Mechanism present; **population audit not run here** |
| Duplicate profiles | Unique constraints / Wave A duplicate_active=0 | Wave A OK; **global Production count unknown in this audit** |
| Missing durable rows | ADR-005: no auto-backfill | **Expected mass gap** vs V2/blob users |
| V2 users without V5 | ADR + Phase 1A | **Expected until migration** |

---

## 8. Data readiness

### What is known (repo evidence)

| Item | Evidence | Confidence |
|------|----------|------------|
| Wave A Production enrollments | 5/5 active (`V5-P1C_ENROLLMENT_RESULTS.md`) | High |
| Wave A expand | `READY TO EXPAND BEYOND 5: NO` | High |
| Public release | `READY FOR PUBLIC RELEASE: NO` | High |
| V2 isolation during Wave A | V2 row count unchanged in enrollment evidence | High for that window |
| Staging owner pilot package | `docs/platform-hard-cutover-01/phase-04/sql/rating-v5-staging-owner-pilot-activation/` | High (staging-only) |
| Full Production V2 population vs V5 coverage % | **Not queried in this audit** | **None** |
| Global duplicate/invalidated/missing durable inventory | No fresh read-only Production export attached to this workstream | **None** |
| Scale remapping plan Owner-approved | Phase 1A forbids conversion; no cutover mapping ADR | **Missing** |

### Readiness verdict

```text
PILOT_SHADOW_READY: YES (narrow Wave A)
PUBLISHED_AUTHORITY_DATA_READY: NO
MIGRATION_COVERAGE_PROVEN: NO
RECONCILIATION_THRESHOLD_MET: NO (no report)
```

**Do not conclude V5 is Production-ready as published authority.**

---

## 9. Migration plan (non-destructive design)

> No SQL authored for apply. Pseudocode only.

### Principles

1. Additive only — never delete V2 rows in migration phase.
2. V5 rows created/updated as shadow first (`is_shadow=true`) until canary.
3. Elo remains separate — do not copy competition Elo into public skill.
4. Provenance required on every migrated profile.
5. Scale: **block** until Owner approves mapping V2(1–8) → V5(1.5–6) **or** dual-display policy.

### Steps

| Step | Action |
|------|--------|
| M0 | **Owner scale decision** — mapping / clamp / reject out-of-band |
| M1 | Snapshot backup: V2 table + V5 profiles + rollout_config + enrollments |
| M2 | Dry-run report: join V2 `auth_user_id` ↔ profiles.id ↔ V5 `player_id` |
| M3 | Classify: `HAS_V5`, `V2_ONLY`, `V5_ONLY`, `CONFLICT`, `UNMAPPED`, `INVALID` |
| M4 | For `V2_ONLY`: insert shadow profile with provenance=`migrated_from_v2`, confidence=low/legacy, assessment_version=`legacy-import`, effective_at=`last_rating_updated_at` |
| M5 | Manual overrides: mark `source=manual_override` — do not overwrite with questionnaire |
| M6 | Duplicates: keep newest by effective_at; quarantine extras |
| M7 | Invalid: quarantine; do not publish |
| M8 | Reconciliation report: counts, max abs(V2−V5), unmapped %, scale outliers |
| M9 | Apply only after Owner GO on dry-run |
| M10 | Verification queries + checksums |
| M11 | Rollback = restore snapshot; re-enable V2 readers; set `is_shadow=true` / pause enrollments |

### Pseudocode (dry-run)

```text
FOR each row in pick_vn_player_ratings:
  map auth_user_id → profiles.id
  IF no profile: mark UNMAPPED
  ELSE IF no player_rating_profiles(player_id, mode): mark V2_ONLY
  ELSE compare current_rating vs display_rating (after scale policy):
    IF within threshold: HAS_V5_ALIGNED
    ELSE: CONFLICT
EMIT reconciliation CSV + checksum(count, sum(current_rating), sum(display_rating))
```

### Checksum / evidence requirements

- Row counts V2 / V5 / mapped / conflict / unmapped
- Hash or sum of ratings pre/post (shadow apply)
- Zero Production deletes
- Rollback snapshot ID + timestamp
- Owner sign-off artifact

---

## 10. Writer freeze plan

### Phase F1 — Pre-cutover freeze (before any canary published read)

| Writer | Action |
|--------|--------|
| `pick_vn_sync_rating` (authenticated) | Revoke or wrap with `WRITER_FROZEN` / service-only |
| Blob independent skill writes | Route through foundation or reject (`CLUB_BLOB_RATING_WRITE_FORBIDDEN`) |
| Monthly public skill apply | Freeze published apply; proposals draft-only |
| Local draft promotion to V2 | Already fail-closed / keep |
| Seed scripts | Production ban list |
| Elo → public skill mirror | Stop writing `current_rating` / public level from Elo paths |

### Phase F2 — Internal allowed during freeze

- V5 shadow assessment completion (pilot)
- Competition Elo (internal)
- Club Elo (club-scoped)
- Read/hydrate mirrors marked `canonicalAuthority: false`

### Phase F3 — Post-stabilization delete

- Silent V2 sync remnants
- V2-first pairing precedence
- Local store as authority
- Eventually archive `pick_vn_player_ratings` readers

---

## 11. Reader cutover plan

| Order | Change | Gate |
|-------|--------|------|
| R1 | Wire foundation `getPlayerRatingOverview` behind internal compare / dual-read | Dual-read compare state |
| R2 | `canonicalAthleteRating`: add V5 branch **behind flag**, compare vs V2, log diffs | Canary cohort |
| R3 | `getPlayerCurrentRating` / club hydrate: prefer V5 published when `is_shadow=false` | Canary |
| R4 | Profiles / roster / membership stamp from V5 | Canary → freeze |
| R5 | Seeding/eligibility: prefer live V5 over snapshot-only | After R3 |
| R6 | Remove V2 precedence | After stabilization + monitoring |
| R7 | Keep VPR / Club Elo / Competition Elo unchanged | Always |

**Do not** flip all readers in one deploy.

---

## 12. State machine

```text
1 V2_PUBLISHED_V5_SHADOW          ← CURRENT
2 V2_PUBLISHED_V5_DUAL_READ_COMPARE
3 V5_CANARY_PUBLISHED
4 V5_PUBLISHED_V2_FROZEN
5 V5_CANONICAL_STABILIZATION
6 V2_READER_REMOVED
7 LEGACY_DATA_ARCHIVED
```

### State details

#### 1. `V2_PUBLISHED_V5_SHADOW` (current)

| | |
|--|--|
| Entry | ADR-005 + Wave A pilot |
| Readers | V2 + blob |
| Writers | V2 RPC live; app writers frozen; V5 shadow via Edge |
| Monitoring | Pilot completions, V2 isolation, enrollment |
| Rollback | Pause enrollment / disable assessment flag |
| Exit | Dual-read tooling live + Owner GO for compare |

#### 2. `V2_PUBLISHED_V5_DUAL_READ_COMPARE`

| | |
|--|--|
| Entry | Compare adapters emit diffs; no UX switch |
| Readers | Still V2; V5 side-read |
| Writers | Same as (1); begin writer freeze rehearsal on Staging |
| Monitoring | Diff rate, unmapped %, scale outliers |
| Rollback | Disable compare flag |
| Exit | Reconciliation ≤ threshold + freeze F1 ready |

#### 3. `V5_CANARY_PUBLISHED`

| | |
|--|--|
| Entry | Owner GO; canary cohort `is_shadow=false`; readers flag canary-only |
| Readers | Canary → V5; others → V2 |
| Writers | V2 frozen for canary ids; V5 durable for canary |
| Monitoring | Pairing/seed/profile parity; support tickets |
| Rollback | Re-shadow canary; readers back to V2 |
| Exit | Canary SLA met N days |

#### 4. `V5_PUBLISHED_V2_FROZEN`

| | |
|--|--|
| Entry | Expand published read; V2 writers frozen globally |
| Readers | Default V5 published; V2 emergency fallback optional |
| Writers | V5 only for public skill |
| Monitoring | Zero V2 writes; error budgets |
| Rollback | Re-enable V2 sync + flip reader flag |
| Exit | Stable window + no P0/P1 |

#### 5. `V5_CANONICAL_STABILIZATION`

| | |
|--|--|
| Entry | Fallback rarely used |
| Readers | V5; fallback logged |
| Writers | V5 + foundation CAS |
| Monitoring | Fallback count → 0 |
| Rollback | Return to (4) |
| Exit | Fallback unused for agreed window |

#### 6. `V2_READER_REMOVED`

| | |
|--|--|
| Entry | Remove V2 from `canonicalAthleteRating` / helpers |
| Readers | V5 only |
| Writers | V5 only |
| Monitoring | Error spikes |
| Rollback | Hotfix reintroduce V2 read (data still present) |
| Exit | Archive plan approved |

#### 7. `LEGACY_DATA_ARCHIVED`

| | |
|--|--|
| Entry | Cold archive / read-only V2 |
| Readers | V5 |
| Writers | V5 |
| Monitoring | Archive access audits |
| Rollback | Restore from archive backup |
| Exit | Terminal |

---

## 13. Rollback plan

| Trigger | Action |
|---------|--------|
| Diff/reconciliation breach | Stay on V2 readers; keep V5 shadow |
| Canary pairing/seed regression | Flip canary reader off; `is_shadow=true` |
| Unexpected V2 writes during freeze | Kill switch grants; incident |
| V5 Edge/persist outage | Fail-closed writes; readers fall back to V2 until (6) |
| Data corruption | Restore M1 snapshot; pause enrollments |

Kill-switch references (existing): `docs/v5/rating-v5/V5-P1_PRODUCTION_DISABLE_RUNBOOK.md`.

**Rule:** Until state 6, V2 data remains intact as rollback SSOT.

---

## 14. Owner GO gates (mandatory before Production cutover)

| # | Gate | Pass criteria |
|---|------|---------------|
| G1 | Complete writer inventory | This audit matrix reviewed + residual call-site CI |
| G2 | Zero unknown published readers | Consumer matrix signed; no new V2-only surfaces without ticket |
| G3 | V5 data coverage threshold | Owner-set % of active athletes with durable V5 profile (evidence query) |
| G4 | Reconciliation threshold | Owner-set max conflict % / abs diff after scale policy |
| G5 | RLS/RPC verification | Fresh Staging + Production read-only proof of write paths |
| G6 | Backup/rollback readiness | Snapshot + runbook drill |
| G7 | Canary cohort | Named users/club; enroll + `is_shadow` plan |
| G8 | Monitoring | Diff dashboards, write denials, Edge errors, fallback counts |
| G9 | No unresolved P0/P1 | C1–C5, C11 closed or accepted with mitigation |
| G10 | Scale mapping Owner decision | Explicit ADR for 1–8 ↔ 1.5–6 |
| G11 | Foundation CAS runtime | `PLAYER_RATING_CLIENT_CAS_RUNTIME` or server-only CAS |
| G12 | Feature flag enablement plan | `PLAYER_RATING_V5_FLAG_ENABLEMENT` scoped env-by-env |
| G13 | **Owner GO** | Written approval artifact for target state (3+) |

**All gates currently FAIL or UNVERIFIED for published cutover** except inventory drafts (this document) and pilot shadow evidence.

---

## 15. Blockers

1. **Published readers still V2/blob-first** (pairing, helpers, membership, roster, profiles).
2. **Scale mismatch** V2 1–8 vs V5 1.5–6 without Owner mapping.
3. **`pick_vn_sync_rating` still a live DB writer** despite app freeze.
4. **Blob/Elo paths still mutate published-facing skill fields**.
5. **Foundation CAS runtime unavailable** (`productionCutover: false`).
6. **No full-population V2↔V5 reconciliation evidence** in this workstream.
7. **Wave A only (5 users)** — not coverage for published authority.
8. Deferred gates open: `PLAYER_RATING_PRODUCTION_CUTOVER`, flag enablement, CAS, match-result algorithm.
9. **No single coded published winner** V5→V2→blob→Elo (by design today; must be built).

---

## 16. Recommended next implementation workstream

**Proposed name:** `RATING-V5-CUTOVER-02 — Dual-Read Compare + Writer Freeze Rehearsal (Staging)`

Scope:

1. Scale-mapping ADR (Owner workshop) — blocking design input.
2. Staging-only dual-read compare adapter + diff report job.
3. Staging writer freeze rehearsal for `pick_vn_sync_rating` + blob skill writes.
4. Read-only Production coverage/reconciliation export (no mutate).
5. Wire foundation read facade to one internal compare surface (not public).
6. CAS runtime design for verification/adjustment (or explicit server-only path).

**Out of scope for -02:** Production canary publish, flag Production ON for all users, V2 delete.

---

## 17. Exact branch / worktree proposal

| Item | Proposal |
|------|----------|
| Audit (this) | Worktree: `rating-v5-published-authority-readiness` · Branch: `audit/rating-v5-published-authority-readiness` |
| Next impl | New worktree: `rating-v5-cutover-02-dual-read-freeze` |
| Next branch | `feature/rating-v5-cutover-02-dual-read-freeze` |
| Base | Current `main` after Owner accepts this audit |
| Canary later | `feature/rating-v5-cutover-03-canary-published` (only after G1–G13) |

---

## 18. Estimated implementation phases

| Phase | Work | Est. effort |
|-------|------|-------------|
| P0 | Owner scale ADR + accept this audit | 1 Owner session |
| P1 | Dual-read compare + Staging freeze rehearsal | 1–2 weeks |
| P2 | Production read-only reconciliation + coverage | 3–5 days (ops) |
| P3 | Reader adapters canary-ready + CAS path | 1–2 weeks |
| P4 | Staging canary dry-run end-to-end | 3–5 days |
| P5 | Production canary (state 3) | Owner-scheduled |
| P6 | V2 freeze + expand (state 4–5) | Owner-scheduled |
| P7 | Remove V2 readers + archive (state 6–7) | After soak |

Estimates are planning-only; not a schedule commitment.

---

## 19. Production mutation status

| Action | Status |
|--------|--------|
| Cutover implemented | **NO** |
| Code / tests changed for cutover | **NO** (audit doc only) |
| SQL executed | **NO** |
| Feature flags changed | **NO** |
| Staging mutated | **NO** |
| Production mutated | **NO** |
| Commit / push | **NO** (unless Owner later requests doc-only commit) |

```text
PRODUCTION_MUTATION_STATUS: UNTOUCHED
```

---

## 20. Final marker

```text
RATING_V5_PUBLISHED_AUTHORITY_READINESS_AUDIT_COMPLETE
```

### Closing statement

V5 durable rating is a **shadow/pilot durable target** with architecture ownership under `player-rating/foundation`. **Published product authority remains V2 `pick_vn_player_ratings.current_rating`.** This audit does **not** authorize Production published-authority cutover.

---

## Appendix A — Key evidence index

| Doc / code | Role |
|------------|------|
| `docs/v5/rating-v5/V5-A1_SHADOW_MODE.md` | V2 production canonical |
| `docs/v5/rating-v5/adr/ADR-005-v2-coexistence.md` | No auto migration |
| `docs/player-rating/bm-final-rating-01/01_CANONICAL_SSOT_DECISION.md` | Architecture SSOT |
| `docs/player-rating/bm-final-rating-01/03_WRITER_FREEZE_MATRIX.md` | App writer freeze |
| `docs/business-modules/final-certification-closure/PLAYER_RATING_SSOT_CERTIFICATION.md` | Deferred production cutover |
| `docs/v5/rating-v5/V5-P1C_FINAL_VERDICT.md` | Wave A only; not public |
| `src/features/player-rating/foundation/adapters/v5/v5DurableRuntime.js` | `productionCutover: false` |
| `src/features/pairing-candidates/canonicalAthleteRating.js` | Published pairing read = V2 |
| `src/features/platform-hard-cutover/ratingCutoverPolicy.js` | Elo ≠ public; blob forbidden as authority |
| `docs/player-rating/phase-1a/03_RATING_SCALE_AND_SSOT_MATRIX.md` | Dual scales; no conversion |

## Appendix B — Assessment authorities

| Module | Path | Role |
|--------|------|------|
| pick-vn-rating (V2) | `src/features/pick-vn-rating/` | Compatibility UI; frozen writers; still what most surfaces publish |
| pick-vn-rating-v5 | `src/features/pick-vn-rating-v5/` | Shadow assessment + durable Edge persist |
| player-rating foundation | `src/features/player-rating/foundation/` | Canonical domain boundary; fail-closed without CAS |
