# Private Pairing Rules Engine V2 — QA Plan

| Field | Value |
|-------|-------|
| Status | Plan from PR-1; PR-2 unit coverage added; full execution in PR-7 |
| Spec | [`PRIVATE_PAIRING_RULES_V2_SPEC.md`](./PRIVATE_PAIRING_RULES_V2_SPEC.md) |
| PR-2 | [`PRIVATE_PAIRING_RULES_V2_PR2_CANONICAL_CONFLICT.md`](./PRIVATE_PAIRING_RULES_V2_PR2_CANONICAL_CONFLICT.md) |
| Security | [`PRIVATE_PAIRING_RULES_V2_SECURITY.md`](./PRIVATE_PAIRING_RULES_V2_SECURITY.md) |
| Migration | [`PRIVATE_PAIRING_RULES_V2_MIGRATION.md`](./PRIVATE_PAIRING_RULES_V2_MIGRATION.md) |
| PR-2 suite | `tests/private-pairing-rules-pr2.test.js` |

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
