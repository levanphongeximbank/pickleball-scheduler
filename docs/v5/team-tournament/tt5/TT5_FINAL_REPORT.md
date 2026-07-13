# TT-5 — Final Integration Report

**Date:** 2026-07-13  
**Status:** COMPLETE  
**Integration branch:** `feature/tt5-referee-v5-integration`  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Production impact:** NONE (staging SQL only; no production deploy)

This report summarizes the **delivered** state after TT-5A through TT-5D commits. It does not treat TT-5A pre-implementation audit findings as current runtime gaps unless noted as remaining limitations.

---

## 1. Repository baseline

| Item | SHA / state |
|------|-------------|
| Integration branch | `feature/tt5-referee-v5-integration` |
| Team Tournament authoritative base | `cb32ae2669182a81ac1cc1f41ad00f51b58b933c` |
| Referee V5 authoritative source | `a678229e7cfba7736d0f62f7d3824d3816175721` |
| Integration merge | `2140c81782dfdd738bf42603b7bcf7f8df9ed356` |
| TT-5A audit docs | `ef16a323d0532811478c05768ef79a625dd251d1` |
| TT-5B | `84810bfeca986c618b67d206b5ffc9a620cb8483` |
| TT-5C | `f36f7cbfcf5a1ca43ce62d567bc5cc3160c6671e` |
| TT-5D | `7cc4b58d72adf309a2e05cc7b51bae2b30722102` |
| Working tree (post TT-5D) | **CLEAN** |

**Worktree:** `pickleball-scheduler-tt5-referee-integration` (integration only; main worktree unchanged).

---

## 2. Phase status summary

| Phase | Type | Commit | Staging SQL | Verdict |
|-------|------|--------|-------------|---------|
| TT-5A | Read-only audit + architecture | `ef16a32` | None | **COMPLETE** |
| TT-5B | Bridge + provision + legacy lock | `84810bf` | Applied | **PASS** |
| TT-5C | Outbox consumer + propagation | `f36f7cb` | Applied | **PASS** |
| TT-5D | Assignment safety + correction + reopen | `7cc4b58` | Applied | **PASS** |

---

## 3. Final architecture — ownership

### Referee V5 owns

- Live scoring and `match_live_states`
- Event history (`match_events`)
- Referee assignment rows (`referee_assignments`) and scoped lifecycle
- Official result revisions (`match_result_revisions`)
- Referee workspace UI (`RefereeV5Workspace`, `/referee/match/:matchId`)
- Correction request lifecycle (`team_tournament_referee_correction_requests`)
- Reopen/finalize revision producer (`referee_v5_apply_admin_result_revision`)
- Integration outbox emission on finalize/revision

### Team Tournament owns

- Tournament header, teams, published lineup
- Sub-match summary (`team_tournament_sub_matches`)
- Matchup aggregate result
- Standings cache (TT-4 recompute only)
- Tournament-level audit (`team_tournament_audit_logs`)
- Tournament progression (publish, forfeit, withdrawal)

### Integration layer owns

- Bridge identity (`team_sub_match_referee_links`)
- Provision/revoke/resync contract (TT-5B/TT-5C)
- Outbox/inbox (`match_integration_outbox`, `team_tournament_referee_event_inbox`)
- Result propagation consumer (`team_tournament_consume_referee_v5_outbox`)
- Reprovision/stale snapshot detection
- Legacy write lock when bridge linked (`scoreOps` / `refereeLinkOps`)

**Official result source of truth:** Referee V5 `match_result_revisions` → one-way consumer → Team Tournament sub-match summary.

---

## 4. Identity and routes

| Concept | Value |
|---------|--------|
| Team sub-match identity | `external_sub_match_id` |
| Referee V5 `match_id` | Same as `external_sub_match_id` |
| Bridge table | `team_sub_match_referee_links` |
| Main referee route | `/referee/match/:matchId` (+ `?tournamentId=` for server guard) |
| Team navigator route | `/team-referee/:id` (legacy portal / hub) |
| Legacy referee when linked | **LOCKED FOR WRITE** — read-only summary via `scoreOps` block codes |

---

## 5. TT-5A summary (audit — `ef16a32`)

Delivered nine audit documents under `docs/v5/team-tournament/tt5/TT5-A_*`:

- **Duplicate logic audit** — identified parallel TT legacy score vs V5 live scoring; recommended single official path.
- **Schema mapping** — `external_sub_match_id` = V5 `match_id`; bridge table recommended and later implemented in TT-5B.
- **Route audit** — primary workspace `/referee/match/:matchId`; `/team-referee/:id` remains navigator.
- **Security/RLS audit** — client cannot write V5 append-only tables; assignment-scoped read.
- **Result propagation recommendation** — outbox + consumer + revision monotonicity (implemented TT-5C).
- **Bridge requirement** — `team_sub_match_referee_links` (implemented TT-5B).
- **Source-of-truth decision** — V5 owns live/official; TT owns aggregate/standings.
- **DreamBreaker** — explicitly out of TT-5 scope.
- **Offline** — non-blocking for online staging pilot; production offline remains a limitation (see §11).

No runtime code or SQL in TT-5A.

---

## 6. TT-5B summary (`84810bf`)

**SQL:** `TT5-B_BRIDGE_SCHEMA.sql`, `TT5-B_PROVISION_RPC.sql`, `TT5-B_LEGACY_LOCK_GUARD.sql`, `TT5-B_GET_SETUP_PATCH.sql`

- Bridge schema with unique sub-match / referee_match_id constraints
- Provision eligibility: published lineup, no `requires_republish`, assignment required, DreamBreaker blocked
- Identity uniqueness enforced at bridge + V5 state id
- Permission mapping: BTC/Director provision via `team_tournament_can_manage()`
- Legacy lock: draft/confirm blocked when link active (`referee_v5_linked_legacy_write_blocked`)
- Revoke link policy before finalized/active scoring
- Staging verification: 6 evidence reports — all **PASS** (`TT5B_*_REPORT.json`)
- Unit: `tests/team-tournament-tt5b.test.js` — **9/9 PASS**

---

## 7. TT-5C summary (`f36f7cb`)

**SQL:** `TT5-C_RESULT_OUTBOX_CONSUMER.sql`, `TT5-C_RESULT_PROPAGATION.sql`, `TT5-C_STANDINGS_RECOMPUTE.sql`, `TT5-C_REPROVISION_STATE.sql`

- Outbox contract: `STANDINGS_RECALC_REQUESTED` → normalized event types
- Inbox + payload hash for exactly-once apply
- Result revision mapping → sub-match status/score/winner
- Matchup recompute + TT-4 standings cache wrapper
- `reprovision_required` when lineup snapshot stale
- BTC minimal UI: `TeamSubMatchRefereeProvisionRow` (provision/resync/revoke)
- Staging E2E: 7 evidence reports — all **PASS** (`TT5C_*_REPORT.json`)
- Unit: `tests/team-tournament-tt5c.test.js` — **10/10 PASS**

---

## 8. TT-5D summary (`7cc4b58`)

**SQL:** `TT5-D_ASSIGNMENT_SAFETY.sql`, `TT5-D_REOPEN_RESULT_REVISION.sql`, `TT5-D_CORRECTION_WORKFLOW.sql`, `TT5-D_SECURITY_GUARDS.sql`

- Assignment scope: tenant/tournament/matchup/sub-match/match_id/version/expiry/revoke
- Expiry: server-time `referee_assignment_expired`; revoke with reason + audit
- Access guard RPC: `team_tournament_referee_match_access_ops` (not UI-only)
- Concurrent finalize: idempotency via `match_sync_mutations` (verified staging)
- Correction request + BTC approve/reject → new revision + consumer
- Reopen: void revision → sub-match `waiting` → re-finalize
- Mobile/status banners on `RefereeV5TeamMatchPage`; BTC `TeamRefereeSafetyPanel`
- Staging security E2E: 7 evidence reports — all **PASS** (`TT5D_*_REPORT.json`)
- Unit: `tests/team-tournament-tt5d.test.js` — **11/11 PASS**

---

## 9. Test summary (integration branch @ `7cc4b58`)

| Gate | Result | Evidence / command |
|------|--------|-------------------|
| Referee V5 unit | **133/133 PASS** | `node --test tests/referee-v5/*.test.js` |
| Referee V5 UI | **36/36 PASS** | `npx vitest run tests/ui/referee-v5-c.test.jsx` |
| Legacy referee | **29/29 PASS** | `tests/referee-engine.test.js`, `referee-polish.test.js`, `referee-flow.integration.test.js`, `referee-rpc-security.test.js` |
| Team Tournament full | **236/236 PASS** | `tests/team-tournament*.test.js` |
| TT-5B unit | **9/9 PASS** | `tests/team-tournament-tt5b.test.js` |
| TT-5C unit | **10/10 PASS** | `tests/team-tournament-tt5c.test.js` |
| TT-5D unit | **11/11 PASS** | `tests/team-tournament-tt5d.test.js` |
| TT-5B staging | **PASS** | `docs/v5/qa-evidence/phase-tt5/TT5B_*` (6 reports) |
| TT-5C staging | **PASS** | `docs/v5/qa-evidence/phase-tt5/TT5C_*` (7 reports) |
| TT-5D staging | **17/17 PASS** | `docs/v5/qa-evidence/phase-tt5/TT5D_*` (7 reports) |
| Build | **PASS** | `npm run build` |
| Scoped lint | **PASS** | `npm run lint:referee-v5` |
| Changed-files lint | **PASS** | ESLint on TT-5D touched JS/JSX |

---

## 10. Security summary

Verified on staging (`qyewbxjsiiyufanzcjcq`):

| Control | Status |
|---------|--------|
| Cross-tenant denied | PASS — `team_tournament_assert_tenant`, access guard |
| Assignment scoped to user/match | PASS |
| Expired assignment blocked | PASS — `referee_assignment_expired` |
| Revoked assignment blocked | PASS |
| Wrong referee blocked | PASS — `REFEREE_NOT_ASSIGNED` |
| Legacy write blocked when linked | PASS — TT-5B lock + `scoreOps` |
| Duplicate finalize blocked / idempotent replay | PASS — TT-5D concurrency report |
| Idempotency enforced | PASS — command + sync mutation keys |
| Result revision tracked | PASS — monotonic revision + inbox dedupe |
| Service-role internal only | PASS — consumer/drain revoked from `authenticated` |
| Anon sensitive RPC | PASS — revoke EXECUTE on anon |
| Production SQL | **NOT APPLIED** |

---

## 11. Remaining limitations

### P0

| ID | Limitation |
|----|------------|
| P0-1 | **Production migration not applied** — all TT-5B/C/D SQL is staging-only until owner-approved production rollout. |
| P0-2 | **Production E2E not executed** — evidence is staging probe tournament only. |

### P1

| ID | Limitation |
|----|------------|
| P1-1 | **Offline queue not production-ready** — TT-5A marked non-blocking for online pilot; offline production remains out of scope. |
| P1-2 | **TT-6 realtime not implemented** — multi-device live sync, reconnect dedupe, degraded polling fallback deferred to TT-6. |
| P1-3 | **DreamBreaker / MLP** — out of TT-5; legacy team referee portal retains parallel path. |
| P1-4 | **Legacy route deprecation incomplete** — `/referee/match/:matchId` falls back to legacy session when V5 disabled or missing `tournamentId`. |
| P1-5 | **Correction UX** — functional via RPC + minimal UI; may need polish before wide production use. |
| P1-6 | **Load/stress testing** — staging functional E2E only; no sustained concurrency load test. |

### P2

| ID | Limitation |
|----|------------|
| P2-1 | **Observability/alerting** — consumer failures set bridge `sync_error` but no dedicated ops dashboard in TT-5. |
| P2-2 | **Outbox drain worker** — consume via RPC/service_role; no always-on production worker documented in TT-5. |
| P2-3 | **Handoff doc SHA references** — some V5 handoff docs predate integration SHAs; use this report as canonical TT-5 baseline. |

---

## 12. Rollback

Per-phase rollback notes:

| Phase | Rollback |
|-------|----------|
| TT-5B | `TT5-B_ROLLBACK.md` — drop bridge RPCs/table policy; restore legacy score path |
| TT-5C | `TT5-C_ROLLBACK.md` — disable consumer; inbox retained for audit |
| TT-5D | `TT5-D_ROLLBACK.md` — drop correction/assignment RPCs; revert access guard |

**General policy:**

- Rollback branch: revert integration merge or feature branch commits in reverse order (D → C → B).
- Feature flags: `VITE_REFEREE_V5_ENABLED`, `VITE_REFEREE_V5_DATA_MODE=remote` — disable V5 workspace without dropping SQL.
- Bridge disable: stop provision; legacy lock releases when link revoked or feature off.
- Consumer disable: revoke `team_tournament_consume_referee_v5_outbox` from callers; outbox rows remain.
- **No hard delete** of `match_result_revisions` or applied inbox rows — preserves official history.
- Official results after finalize remain in V5 revisions; TT summary may lag if consumer disabled (manual resync via TT-5C `resync_referee_link`).

---

## 13. Merge recommendation

### **READY TO MERGE WITH CONDITIONS**

Integration branch delivers a coherent TT-5 stack with staging-verified bridge, propagation, and safety layers. Merge to main (or release integration branch) is reasonable **after owner review of this report**, subject to:

1. **Explicit production migration plan** — separate TT-5 production SQL apply + rollback runbook (not part of TT-5 merge).
2. **Production E2E sign-off** — repeat probe flow on production-like accounts before go-live.
3. **TT-6 scheduled separately** — do not bundle realtime work into TT-5 merge.
4. **No auto-deploy** — merge ≠ production deploy.

**Not recommended:** merging without production migration checklist or while P0 production items remain unowned.

---

## 14. TT-6 readiness

### **TT-6 readiness: YES**

TT-5 closes ownership, propagation, and safety. TT-6 should **only** add:

- Realtime subscriptions (Supabase channels / V5-E1 patterns)
- Reconnect and session recovery
- Server/client deduplication for live state
- Live multi-device synchronization
- Degraded mode / polling fallback when realtime unavailable
- Observability for connection health and stale-state detection

TT-6 must **not** re-open: official result ownership, outbox consumer semantics, bridge identity, or legacy lock policy — those are frozen at TT-5.

---

## 15. Document and evidence index

### Phase docs

| Phase | Key files |
|-------|-----------|
| TT-5A | `TT5-A_*.md` (9 audits), `TT5-A_FINAL_VERDICT.md` |
| TT-5B | `TT5-B_*.sql`, `TT5-B_IMPLEMENTATION.md` |
| TT-5C | `TT5-C_*.sql`, `TT5-C_IMPLEMENTATION.md` |
| TT-5D | `TT5-D_*.sql`, `TT5-D_IMPLEMENTATION.md` |

### Staging evidence

`docs/v5/qa-evidence/phase-tt5/` — 20 JSON reports (TT5B×6, TT5C×7, TT5D×7) + `TT5_FINAL_REPORT.json`

---

## 16. Verdict

**TT-5: COMPLETE**

- Architecture frozen for online staging pilot
- Staging SQL applied (B/C/D)
- Production **UNTOUCHED**
- Next: **TT-6** after owner review — not started by this report
