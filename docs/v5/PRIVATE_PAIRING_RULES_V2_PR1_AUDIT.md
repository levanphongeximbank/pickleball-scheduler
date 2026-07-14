# Private Pairing Rules Engine V2 — PR-1 Audit hiện trạng

| Field | Value |
|-------|-------|
| Phase | **PR-1 — Audit only** |
| Date | 2026-07-14 |
| Branch | `feature/rating-v5-production-wave-a` |
| Baseline commit | `add62869e558fc65ac9a08fdea32cea896a1e857` |
| Behavior change | **None** — docs only |
| Production status | **NOT STARTED** — no deploy, no migration |
| Related prior audit | `docs/competition-core/CC03_CURRENT_STATE_AUDIT.md`, `CC07C_FOUNDER_POLICY_DUAL_PATH_AUDIT.md` |

---

## Verdict

Hệ thống hiện có **Founder Pairing Constraints** (UI + local blob + post-hoc optimizer) và một **Competition Core Rules V2** (canonical types + hard reject + conflict detect) chạy song song sau feature flag. **Không** đáp ứng đủ Private Pairing Rules Engine V2: thiếu opponent constraints, scope/time, ANY_OF/ALL_OF, versioning/rollback, RLS/RPC, dedicated admin route, permission granularity, simulator, và hard-filter tuyệt đối trên đường AI legacy.

**GO cho PR-2** (canonical types + conflict detector) trên nhánh feature riêng, không đụng Production.

---

## Phase report (bắt buộc)

| Item | Status |
|------|--------|
| Branch | `feature/rating-v5-production-wave-a` (audit docs; triển khai nên tách `feature/private-pairing-rules-v2`) |
| Baseline commit | `add62869e558fc65ac9a08fdea32cea896a1e857` |
| Files changed (PR-1) | Docs only under `docs/v5/PRIVATE_PAIRING_RULES_V2_*.md` |
| Database changes | **None** |
| RBAC/RLS changes | **None** |
| Tests | **Not run as part of PR-1** (no code change) |
| Build | **Not required** (docs only) |
| Known risks | Dual-path scoring; club blob leak; hard-as-penalty on AI legacy |
| Rollback method | Delete/revert docs commits only |
| Production status | **OFF / not deployed** |

---

## 1. Inventory — modules checked

| Area | Path(s) | Role today |
|------|---------|------------|
| UI panel | `src/features/pairing-constraints/components/FounderPairingConstraintsPanel.jsx` | Inline editor: prefer/avoid partner, avoid same group |
| Feature gate | `SuperAdminFeatureGate.jsx` | Fail-closed: needs `rbacEnabled && isSuperAdmin` |
| Route guard | `guards/superAdminRouteGuard.jsx` | Redirect `/403` when RBAC on + not super admin; **not wired to a dedicated private-rules route** |
| Model | `models/pairingConstraint.js` | `{ id, type, anchorPlayerId, targetPlayerIds[], mode, enabled, label, note }` |
| Constants | `constants.js` | `prefer_partner`, `avoid_partner`, `avoid_same_group`; hard/soft; fixed scores |
| Service | `services/pairingConstraintService.js` | Guard via `isGlobalRole`; read/merge club+tournament field; audit `PAIRING_OVERRIDE` |
| Evaluator | `engines/constraintEvaluator.js` | Partner/group score + hard violations list; bridges to CC Rules V2 when flagged |
| Pairing optimizer | `engines/constraintPairingEngine.js` | **Post-hoc swap** after initial pairing (`fixAvoidPartner` / `applyPreferPartner`) |
| Group engine | `engines/constraintGroupEngine.js` | Post-hoc group swaps for `avoid_same_group` |
| AI adapter | `adapters/courtPolicyAdapter.js` | → `prefer_teammate` / `avoid_teammate` policies (`source=founder`) |
| Consumers | `SelectPlayers.jsx`, `InternalTournamentSetup.jsx`, `OfficialTournamentSetup.jsx`, `teamPairingEngine.js`, AI `scoring.js` / `engine.js` | Embedded panel + policies / optimize after suggest |
| Storage | `domain/clubStorage.js` + tournament record field | `founderPairingConstraints: []` inside club blob / tournament object |
| Competition Core | `src/features/competition-core/constraints/*` | Canonical types, detectConflicts, evaluateHardRules, soft scoring, explanation, Rules V2 flags |
| Identity | `permissions.js`, `roles.js`, `auditService.js` | `platform.pairing_override` defined but **unused in role matrix**; audit action `pairing_override` |
| Menu | `src/config/v5Menu/systemTechnicianMenu.js` | Has “Quản trị hệ thống” under **SYSTEM_TECHNICIAN**, not SUPER_ADMIN private-rules tree |

---

## 2. Constraint types coverage (as-is vs V2)

| V2 canonical type | Present today | Where | Gap |
|-------------------|---------------|-------|-----|
| PREFER_PARTNER | Yes (`prefer_partner`) | pairing-constraints + AI prefer_teammate | Soft weights fixed; no per-rule weight 1–100; no priority enum |
| MUST_PARTNER | Type only in Competition Core | `constraintType.js` + hard evaluator when Rules V2 ON | **Not in Founder UI**; no creation path for private rules |
| AVOID_PARTNER | Yes | pairing-constraints + AI avoid_teammate | Legacy AI: hard = **-120 penalty**, not reject (unless Rules V2 owns path) |
| MUST_NOT_PARTNER | Type only in Competition Core | hard evaluator when Rules V2 ON | Founder UI uses `avoid_partner` hard instead of distinct MUST_NOT |
| PREFER_OPPONENT | **No** | — | Missing |
| MUST_OPPONENT | **No** | — | Missing |
| AVOID_OPPONENT | Soft type in CC (`avoid_opponent`) | Rules V2 soft scoring | Not in Founder UI / private rules model |
| MUST_NOT_OPPONENT | **No** | — | Missing |
| MAX/MIN_*_REPEAT | Soft max in AI/CC | scoring / ruleConstants | No private-rule window UI; no MIN_* |
| SAME/DIFFERENT GROUP/TEAM | Partial (`avoid_same_group` → mapped as same_club_separation) | group engine + CC | Not full V2 set |

---

## 3. Hard vs soft — critical finding

| Path | Hard behavior | Meets V2 “vi phạm → loại”? |
|------|---------------|----------------------------|
| `constraintEvaluator` + pairing optimizer | Hard → `violations` / `ok:false`; optimizer tries swaps then may still return warnings | **Partial** — can still emit teams with hard violations after attempts |
| Legacy AI `calculatePolicyScore` | HIGH avoid → `avoidTeammateHardPenalty` (**-120**) | **No** — score simulation |
| Competition Core Rules V2 (`evaluateHardRules` + orchestrator) | Reject candidate when flag ON | **Yes** for mapped types |
| Default production flags | `VITE_COMPETITION_CORE_*` default **false** | Rules V2 hard path often **off** |

V2 requirement: hard must never be “large negative score only”. **PR-3 must kill legacy penalty path for private hard rules** when Unified Constraint Engine is ON.

---

## 4. Multi-target / relation mode

- UI allows multiple `targetPlayerIds` (B, C, D…).
- Evaluation of PREFER uses **first matched target** (implicit **ANY_OF**).
- **ALL_OF** is not modeled; no team-size preflight for ALL_OF.
- Self-link / duplicate targets: weak client validation only (no service-level conflict engine on save).

---

## 5. Scope / time / reason / visibility

| Field | As-is |
|-------|-------|
| scope_type / scope_id | Implicit only: stored on **club blob** or **tournament** object |
| start_at / end_at / active | `enabled` boolean only; no expiry |
| reason_category | Free-text `note` only |
| visibility (private/disclosed/public) | **None** |
| Official / certified disclosure gate | Official setup embeds same Founder panel as Internal — **no official block** |
| Competition Core CONSTRAINT_SCOPE | Domain scopes (`pairing`/`group`/`match`/…) — **not** tenant/club/tournament application scopes |

---

## 6. Security & RBAC gaps

| Control | As-is | V2 need |
|---------|-------|---------|
| View/manage | UI gate + `guardFounderConstraints` (`isGlobalRole` = PLATFORM_ADMIN / SUPER_ADMIN alias) | Explicit perms `pairing.private_rules.*` |
| Permission constant | `platform.pairing_override` exists, **not granted in matrix / unused** | New four perms; SUPER_ADMIN only |
| Dedicated route | **None** — panel embedded in SelectPlayers / Internal / Official setup | `/admin/ai-pairing/private-rules` + 403 |
| SuperAdminRouteGuard | Exists but unused for private-rules menu | Wire + return `403_FORBIDDEN` code/page |
| Service | Client-side role check only | Server RPC deny + RLS |
| Storage | In club/tournament JSON (synced via club blob / tournament persistence) | Normalized tables; strip from public payloads |
| RLS / RPC | **None** for private pairing rules | Required PR-4 |
| Realtime | N/A table; **club blob sync can expose field** if consumers read full blob | Must redact |
| Export | Tournament/club export may include field if full object exported | Redact unless SUPER_ADMIN |
| Audit | `PAIRING_OVERRIDE` with before/after in metadata | Dedicated action codes + SUPER_ADMIN-only audit viewer |
| Soft delete | Hard remove from array in UI | `active=false`, `deleted_at`, `deleted_by` |
| When RBAC off | Gate hides UI (fail-closed) — good | Must not rely on UI alone |

**Data leak risk (HIGH):** `founderPairingConstraints` lives on club data default shape and tournament records. Any consumer of full club blob / tournament payload without strip can expose private preferences to non–SUPER_ADMIN clients.

---

## 7. Engine integration & consumers

```text
Founder UI
  ├─ Club (SelectPlayers) → clubData.founderPairingConstraints
  │     └─ constraintsToCourtPolicies → AI context.policies (source=founder)
  ├─ Internal / Official setup → tournament.founderPairingConstraints
  │     └─ suggestTeamsFromPlayers(..., pairingConstraints)
  │           └─ create teams → optimizeTeamsWithConstraints (post-hoc swaps)
  └─ (optional) Competition Core bridge when RULES_V2 ON
        └─ mapPairingConstraintsToRuleSet / mapAiContextToRuleSet
              └─ hard reject + soft score + conflict detect
```

| Consumer | Uses founder rules? | Gap vs V2 |
|----------|---------------------|-----------|
| teamPairingEngine | Yes (optimize after) | Not generate-time hard filter |
| Daily Play / SelectPlayers AI | Via policies | Hard via penalty unless V2 |
| Internal tournament | Yes | Same |
| Official tournament | Yes, **no certified restriction** | Must block personal prefs by default |
| Court Engine auto assignment | Repeat soft scores only | No private rules adapter |
| pairing-intervention | Separate SUPER_ADMIN tooling | Parallel, not unified |

---

## 8. Conflict detection / simulate / explain / version

| Capability | As-is |
|------------|-------|
| Pre-save conflict detection | **No** in Founder panel; CC `detectConstraintConflicts` exists for canonical RuleSet |
| Simulator UI | **No** |
| Result explanation for SUPER_ADMIN | CC `buildExplanation` when Rules V2; Founder path mostly warnings strings |
| rule_set_id / version / rollback | CC defaults (`competition-core-default` / `"1"`); founder array **no versioning** |
| Soft-delete + audit actions | Partial audit only |

---

## 9. Feature flags (as-is)

| Flag | Default | Relation to V2 |
|------|---------|----------------|
| `VITE_COMPETITION_CORE_ENABLED` | false | Master for CC |
| `VITE_COMPETITION_CORE_RULES_V2_ENABLED` (+ deprecated CONSTRAINTS_V2 alias) | false | Canonical hard/soft engine |
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | **Does not exist** | Required by V2 §18 |
| `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` | **Does not exist** | Required by V2 §18 |

---

## 10. Tests (as-is)

| Suite | Covers |
|-------|--------|
| `tests/pairing-constraints.test.js` | avoid/prefer partner, group avoid, court policies, basic scoring |
| `tests/pairing-constraints-guard.test.js` | role guard, founder source tag, hard avoid vs system prefer |
| `tests/competition-core-rules*.test.js` | Rules V2 orchestrator, conflicts, hard/soft, CC-07 / CC-07C dual-path |
| Missing vs V2 §20 | Opponent constraints, ANY_OF/ALL_OF, scope expiry, official disclosure, RLS leak, versioning/rollback, dedicated perms, simulate |

---

## 11. Gap summary vs Acceptance Criteria (§21)

| # | Criterion | As-is |
|---|-----------|-------|
| 1 | SUPER_ADMIN only | Partial (role gate; no dedicated perms; embed in setup pages; blob leak risk) |
| 2 | Hard absolute reject | Partial (CC V2 yes; legacy AI/penalty + post-hoc optimizer no) |
| 3 | Partner + opponent | Partner only (partial opponent in CC soft) |
| 4 | Multi-target | Yes (implicit ANY_OF) |
| 5 | ANY_OF / ALL_OF | ANY_OF only |
| 6 | Scope + time | Missing |
| 7 | Conflict before save | Missing in Founder UI |
| 8 | Simulate | Missing |
| 9 | Explanation | Partial (CC only) |
| 10 | Audit full | Partial |
| 11 | Versioning / rollback | Missing for founder set |
| 12 | No API/RLS/realtime leak | **Fail** (client blob field) |
| 13 | Official/certified limits | **Fail** (same panel on Official) |
| 14 | Migration parity | Not started |
| 15 | Lint/build/tests PASS for V2 | N/A until implementation |

---

## 12. Recommended reuse (do not rewrite from zero)

Reuse / extend:

1. `competition-core` canonical pipeline: normalize → detectConflicts → hard filter → soft score → explanation.
2. `legacyRuleMappers.mapPairingConstraintsToRuleSet` as seed of founder → private-rules adapter.
3. `founderPolicyIdentity` + deduplication plans (CC-07C).
4. `SuperAdminFeatureGate` patterns (strengthen with permission checks).
5. Existing audit service — extend action vocabulary.

Replace / deprecate (after parity):

1. Direct reliance on `founderPairingConstraints` array as source of truth.
2. Legacy AI `-120` hard path for private rules when Unified Engine ON.
3. Post-hoc-only `optimizeTeamsWithConstraints` as sole enforcement (keep as fallback under flag OFF).

---

## 13. PR sequence confirmation

| PR | Focus | Depends on |
|----|-------|------------|
| PR-1 | This audit + V2 docs | — |
| PR-2 | Canonical private-rule types + conflict detector | PR-1 |
| PR-3 | Unified runtime engine | PR-2 |
| PR-4 | DB/RLS/RPC/audit (staging only) | PR-3 |
| PR-5 | SUPER_ADMIN UI + route + simulator | PR-4 types/API contract |
| PR-6 | Legacy migration + parity | PR-3 + PR-4 |
| PR-7 | Staging QA; stop for owner GO | All above |

**Production:** blocked until owner GO after PR-7.
