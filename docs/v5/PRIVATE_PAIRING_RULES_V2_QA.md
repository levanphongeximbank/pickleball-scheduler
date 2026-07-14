# Private Pairing Rules Engine V2 — QA Plan

| Field | Value |
|-------|-------|
| Status | Plan from PR-1; PR-2/PR-3/PR-4 unit coverage; Staging JWT QA after owner apply GO |
| Spec | [`PRIVATE_PAIRING_RULES_V2_SPEC.md`](./PRIVATE_PAIRING_RULES_V2_SPEC.md) |
| PR-2 | [`PRIVATE_PAIRING_RULES_V2_PR2_CANONICAL_CONFLICT.md`](./PRIVATE_PAIRING_RULES_V2_PR2_CANONICAL_CONFLICT.md) |
| PR-3 | [`PRIVATE_PAIRING_RULES_V2_PR3_RUNTIME.md`](./PRIVATE_PAIRING_RULES_V2_PR3_RUNTIME.md) |
| PR-4 | [`PRIVATE_PAIRING_RULES_V2_PR4_DATABASE_SECURITY.md`](./PRIVATE_PAIRING_RULES_V2_PR4_DATABASE_SECURITY.md) |
| Security | [`PRIVATE_PAIRING_RULES_V2_SECURITY.md`](./PRIVATE_PAIRING_RULES_V2_SECURITY.md) |
| Migration | [`PRIVATE_PAIRING_RULES_V2_MIGRATION.md`](./PRIVATE_PAIRING_RULES_V2_MIGRATION.md) |
| PR-2 suite | `tests/private-pairing-rules-pr2.test.js` |
| PR-3 suite | `tests/private-pairing-rules-pr3-runtime.test.js` |
| PR-4 suites | `tests/private-pairing-rules-pr4-database-security.test.js`, `tests/private-pairing-rules-pr4-repository.test.js` |

---

## 1. Environments

| Env | Purpose |
|-----|---------|
| Local | Unit + engine fixtures |
| Test / CI | Automated suites green |
| Staging | RLS/RPC/browser/realtime leak |
| Pilot tenant | Soft launch under Private flag |
| Production | **Blocked** until owner GO |

---

## 1b. PR-2 unit coverage (done in PR-2)

- [x] Canonical types accepted / unknown rejected
- [x] Legacy mapping prefer/avoid/teammate/same_group
- [x] Validation: self/duplicate/empty/scope/time/weight/ALL_OF/certified
- [x] Conflicts: must±partner, must±opponent, partner vs opponent, chain, soft-soft, hard-soft, scope/time isolation, ANY_OF≠ALL_OF
- [x] Deterministic + non-mutating detector
- [x] Feature flags default OFF
- [x] Competition Core + legacy pairing regression suites PASS

## 1c. PR-3 runtime coverage (done in PR-3)

- [x] Hard MUST_PARTNER / MUST_NOT_PARTNER / MUST_OPPONENT / MUST_NOT_OPPONENT
- [x] Soft prefer/avoid ranking effect
- [x] ANY_OF vs ALL_OF (capacity block)
- [x] Scope/time + certified policy gate
- [x] Determinism + non-mutation
- [x] Legacy adapter + flags OFF unchanged path
- [x] AI score hard reject without -120 when flags ON
- [x] Benchmark guards 8/16/32 players

## 1d. PR-4 database / adapter coverage (done in PR-4 unit tests)

- [x] SQL contract: tables, RLS, revoke writes, no `using (true)`, realtime OFF
- [x] Permissions SUPER_ADMIN only; blocked roles matrix (client)
- [x] RPC names + SECURITY DEFINER + activate hash/preflight gates in SQL
- [x] Flag OFF → repository does not query
- [x] DB → canonical normalize → PR-3 runtime path
- [x] Activate preflight blocks fatal conflicts; hash passed when clear
- [ ] Staging JWT RLS/RPC probes (requires owner staging apply GO)

## 2. Permission tests

- [ ] SUPER_ADMIN opens list/create/simulate/audit
- [ ] Other roles: menu item absent
- [ ] Other roles: direct URL → `403_FORBIDDEN`
- [ ] Other roles: RPC → `403_FORBIDDEN`
- [ ] Cross-tenant SUPER_ADMIN policy matches platform tenant-picker rules
- [ ] Realtime: no private rule payloads on club/tournament channels
- [ ] Export without SUPER_ADMIN: no rule field

---

## 3. Hard constraint tests

- [ ] MUST_PARTNER always satisfied when feasible
- [ ] MUST_NOT_PARTNER never violated in selected result
- [ ] MUST_OPPONENT satisfied when feasible
- [ ] MUST_NOT_OPPONENT never violated
- [ ] No feasible candidate → clear engine error (not silent soft pick)
- [ ] Hard never encoded only as large negative score when Unified ON

---

## 4. Soft constraint tests

- [ ] PREFER_PARTNER increases ranking when feasible
- [ ] AVOID_PARTNER decreases ranking
- [ ] Soft never overrides hard reject
- [ ] Higher weight dominates lower weight (same priority band)

---

## 5. Multi-target tests

- [ ] ANY_OF works
- [ ] ALL_OF works when team size allows
- [ ] ALL_OF infeasible blocked before run

---

## 6. Conflict tests

- [ ] MUST_PARTNER + MUST_NOT_PARTNER same pair blocked
- [ ] MUST_PARTNER exceeds team capacity blocked
- [ ] MUST_OPPONENT + MUST_PARTNER same scope blocked
- [ ] Unsatisfiable cycles detected
- [ ] Soft-only conflicts → warn, allow save with confirmation

---

## 7. Scope / time tests

- [ ] Tournament A rules do not affect B
- [ ] Daily Play rules do not affect official
- [ ] Expired rules inert
- [ ] GLOBAL + TOURNAMENT merge/priority correct

---

## 8. Official / certified tests

- [ ] Personal preference blocked by default on CERTIFIED/OFFICIAL/VPR_RANKED
- [ ] Disclosed + documented reason allowed with audit
- [ ] Objective regulation rules still work
- [ ] Audit captures APPLY/ROLLBACK for official

---

## 9. Versioning tests

- [ ] Update creates new version
- [ ] Rollback restores prior definition
- [ ] Old results keep recorded `rule_set_version`
- [ ] Retry does not duplicate versions

---

## 10. Migration / parity tests

- [ ] Legacy arrays readable via adapter
- [ ] Parity fixtures pass for supported cases
- [ ] No data loss
- [ ] Flag OFF returns to legacy path

---

## 11. UI / mobile

- [ ] List, filters, wizard, relation map, conflict preview, simulator
- [ ] Responsive layout on phone/tablet
- [ ] Color + text labels + tooltips for Prefer/Must/Avoid/Must Not
- [ ] Vietnamese copy: **Quy tắc ghép cặp riêng**

---

## 12. Non-functional

- [ ] Lint PASS
- [ ] Unit/integration PASS
- [ ] Build PASS
- [ ] No private rules in network responses for non-admin (browser network capture)

---

## 13. Existing regression suites to keep green

| Suite | Why |
|-------|-----|
| `tests/pairing-constraints.test.js` | Legacy optimizer |
| `tests/pairing-constraints-guard.test.js` | Role guard / founder policies |
| `tests/competition-core-rules*.test.js` | Canonical engine / dual-path |
| SelectPlayers / team pairing related tests | Consumer regression |

---

## 14. PR-7 exit report template

```text
Branch:
Baseline commit:
Files changed:
Database changes: (staging only / none production)
RBAC/RLS changes:
Tests: (commands + pass/fail)
Build:
Known risks:
Rollback method:
Production status: NOT DEPLOYED — awaiting owner GO
```

Stop after staging report. No Production until owner GO.

---

## 15. PR-4.25 Canonical Repository QA

See [`PRIVATE_PAIRING_RULES_V2_PR425_QA.md`](./PRIVATE_PAIRING_RULES_V2_PR425_QA.md).

Mandatory: ACCC cloud-only fixture + club/membership/player/private-pairing adapter tests (22). Production flags stay OFF.

---

## 16. PR-4.26 Consumer Parity QA

See [`PRIVATE_PAIRING_RULES_V2_PR426_PARITY_QA.md`](./PRIVATE_PAIRING_RULES_V2_PR426_PARITY_QA.md). Cross-consumer ACCC selectable playerId parity required when flags ON.

---

## 17. PR-4.5 Simulation QA

See [`PRIVATE_PAIRING_RULES_V2_PR45_QA.md`](./PRIVATE_PAIRING_RULES_V2_PR45_QA.md) and benchmarks in [`PRIVATE_PAIRING_RULES_V2_PR45_BENCHMARK.md`](./PRIVATE_PAIRING_RULES_V2_PR45_BENCHMARK.md). Production simulation flag stays OFF.
