# Private Pairing Rules Engine V2 — Product & Technical Spec

| Field | Value |
|-------|-------|
| UI name (VI) | **Quy tắc ghép cặp riêng** |
| Module name | Private Pairing Rules Engine |
| Access | SUPER_ADMIN only |
| Status | PR-1 audit + PR-2 types/conflicts + **PR-3 unified runtime (flag-gated)** |
| Audit | [`PRIVATE_PAIRING_RULES_V2_PR1_AUDIT.md`](./PRIVATE_PAIRING_RULES_V2_PR1_AUDIT.md) |
| PR-2 | [`PRIVATE_PAIRING_RULES_V2_PR2_CANONICAL_CONFLICT.md`](./PRIVATE_PAIRING_RULES_V2_PR2_CANONICAL_CONFLICT.md) |
| PR-3 | [`PRIVATE_PAIRING_RULES_V2_PR3_RUNTIME.md`](./PRIVATE_PAIRING_RULES_V2_PR3_RUNTIME.md) |
| Security | [`PRIVATE_PAIRING_RULES_V2_SECURITY.md`](./PRIVATE_PAIRING_RULES_V2_SECURITY.md) |
| Migration | [`PRIVATE_PAIRING_RULES_V2_MIGRATION.md`](./PRIVATE_PAIRING_RULES_V2_MIGRATION.md) |
| QA | [`PRIVATE_PAIRING_RULES_V2_QA.md`](./PRIVATE_PAIRING_RULES_V2_QA.md) |
| Code module | `src/features/private-pairing-rules/` (+ `runtime/`) |

---

## 1. Goal

Replace fragmented Founder pairing constraints with a unified, secure rules engine that SUPER_ADMIN configures **before** pairing runs. Rules must influence candidate generation/filtering — never silent post-result edits.

Supported intents:

- Prefer / must / avoid / must-not **partner**
- Prefer / must / avoid / must-not **opponent**
- Max/min partner or opponent repeats over a window
- Group/team same/different constraints (canonical set)

---

## 2. Permissions

```text
pairing.private_rules.view
pairing.private_rules.manage
pairing.private_rules.audit
pairing.private_rules.simulate
```

Granted **only** to `SUPER_ADMIN` in this phase.

Denied (explicit non-grants): TECHNICIAN, TOURNAMENT_DIRECTOR, COURT_OWNER, VENUE_MANAGER, CLUB_OWNER, CLUB_MANAGER, REFEREE, COACH, PLAYER, and all other tenant/club roles.

Protect: sidebar, route, component, service, RPC, RLS, realtime, export, audit, direct URL.

Unauthorized URL/API → `403_FORBIDDEN`. Never embed private rule payloads in normal tournament/club/Daily Play/match responses.

---

## 3. Canonical constraint types

```text
PREFER_PARTNER | MUST_PARTNER | AVOID_PARTNER | MUST_NOT_PARTNER
PREFER_OPPONENT | MUST_OPPONENT | AVOID_OPPONENT | MUST_NOT_OPPONENT
MAX_PARTNER_REPEAT | MAX_OPPONENT_REPEAT | MIN_PARTNER_REPEAT | MIN_OPPONENT_REPEAT
SAME_GROUP | DIFFERENT_GROUP | SAME_TEAM | DIFFERENT_TEAM
```

### Semantics (partner / opponent)

| Type | Soft default | Hard default | Meaning |
|------|--------------|--------------|---------|
| PREFER_PARTNER | soft | — | Prefer same team; miss allowed |
| MUST_PARTNER | — | hard | Same team required; infeasible → engine error, no silent skip |
| AVOID_PARTNER | soft | optional hard | Prefer not same team |
| MUST_NOT_PARTNER | — | hard | Never same team; reject before ranking |
| PREFER_OPPONENT | soft | — | Prefer opposite sides |
| MUST_OPPONENT | — | hard | Must be opponents in applicable match |
| AVOID_OPPONENT | soft | optional hard | Prefer not meet |
| MUST_NOT_OPPONENT | — | hard | Never opponents in same match |

---

## 4. Hard vs soft

Every rule has `severity: hard | soft`.

- **Hard:** violation → **eliminate candidate**. Never encode as `-100/-120/-200` alone.
- **Soft:** `weight: 1–100`, `priority: low | medium | high | critical` → score delta only.

### Engine pipeline (mandatory order)

```text
1. Eligibility validation
2. Conflict detection
3. Hard constraint filtering
4. Fairness and skill validation
5. Soft constraint scoring
6. Candidate ranking
7. Result explanation
8. Audit snapshot
```

---

## 5. Multi-target relation modes

Primary player A + targets `[B, C, D]`:

- **ANY_OF** — satisfy with ≥1 target
- **ALL_OF** — satisfy with all targets when team size allows; otherwise **config invalid before engine run**

---

## 6. Scope

```text
GLOBAL | TENANT | CLUB | VENUE | TOURNAMENT | TOURNAMENT_EVENT
DAILY_PLAY_SESSION | ROUND | MATCH_DAY
```

Each rule: `scope_type`, `scope_id`, `start_at`, `end_at`, `active`. Expired rules inactive.

Resolution order (later overrides / merges per PR-3 design note): more specific scope wins for conflicts; inactive/expired excluded.

---

## 7. Reason category

```text
PLAYER_REQUEST | FAMILY_RELATIONSHIP | COACHING_REQUIREMENT
MEDICAL_OR_SAFETY | CONFLICT_AVOIDANCE | TEAM_BALANCE
EVENT_OPERATION | SPECIAL_GUEST | OTHER
```

`OTHER` requires `reason_text`. Reasons never shown to players or ordinary managers.

---

## 8. Activity policy

| Context | Allowed |
|---------|---------|
| Daily Play / internal social | Full personal partner/opponent set |
| Club internal tournament | Allowed with **warnings** on MUST_* / MUST_NOT_* |
| OFFICIAL / CERTIFIED / VPR_RANKED | Personal prefs blocked by default; objective regulation rules OK; personal MUST/PREFER only if `visibility=disclosed` + documented charter/minutes |

---

## 9. Visibility

| Mode | Audience |
|------|----------|
| `private` | SUPER_ADMIN only |
| `disclosed` | Participants see generic “conditional draw per regulations” — not personal details |
| `public` | Published in regulations (e.g. seed separation) |

---

## 10. SUPER_ADMIN UI

- Route: `/admin/ai-pairing/private-rules`
- Menu: Quản trị hệ thống → AI & Ghép cặp → Quy tắc ghép cặp riêng

### List columns

VĐV chính, loại quy tắc, người liên quan, mức độ, trọng số, phạm vi, thời gian, trạng thái, người tạo, ngày cập nhật.

### Filters

CLB, giải, Daily Play session, VĐV, loại, hard/soft, active/expired.

### Create wizard (11 steps)

Scope → primary player → relation type → targets → hard/soft → ANY_OF/ALL_OF → weight (soft) → validity window → reason → conflict check → save.

### Visual map

Tree/chips with labels + tooltips (not color-only): Prefer / Must / Avoid / Must Not.

### Simulator

Button **Mô phỏng ghép cặp**: selected candidate, balance/fairness scores, satisfied/missed soft rules, rejected candidates + reasons. SUPER_ADMIN only.

---

## 11. Conflict detection

Module: `constraintConflictDetectionEngine` (extend Competition Core `detectConstraintConflicts`).

Block on unsatisfiable hard conflicts; warn on soft conflicts; show conflicting rule ids; suggest fixes; **never auto-delete/rewrite**.

---

## 12. Explanation contract

Each engine run returns:

```text
selected_candidate
rejected_candidates
hard_constraints_applied
soft_constraints_satisfied
soft_constraints_missed
fairness_score
balance_score
constraint_score
final_score
rule_set_version
```

---

## 13. Audit actions

```text
CREATE_PRIVATE_PAIRING_RULE
UPDATE_PRIVATE_PAIRING_RULE
DISABLE_PRIVATE_PAIRING_RULE
DELETE_PRIVATE_PAIRING_RULE   # soft delete
SIMULATE_PRIVATE_PAIRING
APPLY_PRIVATE_PAIRING_RULESET
ROLLBACK_PRIVATE_PAIRING_RULESET
```

Fields: actor_id, actor_role, timestamp, action, reason, before_data, after_data, scope_type, scope_id, rule_set_version, request_id, ip_or_session_reference.

Delete UX → soft: `active=false`, `deleted_at`, `deleted_by`.

---

## 14. Versioning

`private_pairing_rule_sets`: id, tenant_id, name, scope_*, version, status (`draft|active|archived`), created_by, created_at, activated_at, archived_at.

Updates to active set → **new version**, not overwrite. Pairing stores applied `rule_set_version`. Rollback restores prior version definition; historical results unchanged.

---

## 15. Data model

```text
private_pairing_rule_sets
private_pairing_rules
private_pairing_rule_targets
private_pairing_rule_audit_logs
```

Normalized FKs, indexes, RLS, tenant isolation; no direct client table access for non–SUPER_ADMIN.

Logical fields on rules: primary_player_id, constraint_type, severity, weight, relation_mode, reason_*, visibility, start_at, end_at, active, created/updated by/at, deleted_at.

---

## 16. Integration

Legacy paths to unify via adapter:

```text
founderPairingConstraints
prefer_partner / avoid_partner
prefer_teammate / avoid_teammate
```

Consumers: teamPairingEngine, Daily Play, Internal, Official draw, AI pairing, Court Engine, SelectPlayers.

Migration path: legacy → adapter → canonical → unified engine. Keep legacy until parity + flag OFF rollback works.

---

## 17. Feature flags

```text
VITE_PRIVATE_PAIRING_RULES_ENABLED=false
VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED=false
```

Prefer server-side flags for security. Rollout: Local → Test → Staging → Pilot tenant → Production (owner GO required).

Reuse existing Competition Core Rules V2 as runtime substrate when Unified flag ON; Private Pairing flag gates UI + storage + load into rule sets.

---

## 18. Validation (pre-save / pre-run)

Player exists & in scope; no self-link; no duplicate targets; hard feasibility; not expired; gender/event eligibility; team size for ALL_OF; roster limits; no unsatisfiable cycles; locked versions immutable; tenant isolation; no client spoof of SUPER_ADMIN.

---

## 19. Implementation phases

| PR | Deliverable |
|----|-------------|
| PR-1 | Audit + these docs (done) |
| PR-2 | Canonical types + conflict detector (done) |
| PR-3 | Unified runtime hard/soft/explain (**done**, flag-gated; teamPairingEngine + AI scoring) |
| PR-4 | DB/RLS/RPC/audit — staging only |
| PR-4 | DB/RLS/RPC/audit — staging only |
| PR-5 | SUPER_ADMIN UI + simulator |
| PR-6 | Legacy migration + parity |
| PR-7 | Staging QA → stop for GO |

---

## 20. Acceptance Criteria

Same as owner brief §21 (1–15). Feature complete only when all pass with lint/build/tests green and Production remains OFF until GO.

---

## 21. Legacy mapping (Founder → V2)

| Legacy | Default V2 mapping |
|--------|--------------------|
| `prefer_partner` soft | PREFER_PARTNER soft, ANY_OF, weight≈80 |
| `prefer_partner` hard | MUST_PARTNER hard (or PREFER with critical + UI warning — prefer MUST in migration if mode=hard) |
| `avoid_partner` soft | AVOID_PARTNER soft |
| `avoid_partner` hard | MUST_NOT_PARTNER hard |
| `avoid_same_group` | DIFFERENT_GROUP / SAME_CLUB_SEPARATION regulatory style |
| `prefer_teammate` / `avoid_teammate` policies | Same as prefer/avoid partner via courtPolicyAdapter identity |

Details: [`PRIVATE_PAIRING_RULES_V2_MIGRATION.md`](./PRIVATE_PAIRING_RULES_V2_MIGRATION.md).

---

## 22. Naming

| Context | Name |
|---------|------|
| UI | Quy tắc ghép cặp riêng |
| Code module (proposed) | `src/features/private-pairing-rules/` (or evolve `pairing-constraints` in place — decide in PR-2) |
| Storage field (legacy) | `founderPairingConstraints` — keep until migration complete |
| Canonical SoT | `private_pairing_rule_sets` + rules/targets |

---

## 23. PR-4.25 — Canonical Club & Player Repository

Shared repositories (not per-module) resolve club / membership / player identity for Private Pairing selectors.

| Flag | Default |
|------|---------|
| `VITE_CANONICAL_CLUB_REPOSITORY_ENABLED` | `false` |
| `VITE_CANONICAL_PLAYER_REPOSITORY_ENABLED` | `false` |

- Club SSOT: `public.clubs` (RPC). Membership SSOT: `club_members`.
- Player ids: `profiles.player_id` or derived `player-auth-{userId}` policy — never profile id in rule `primary_player_id`.
- Docs: `PRIVATE_PAIRING_RULES_V2_PR425_*.md`.
- Verdict target: Private Pairing CONSISTENT with flags ON; system-wide still PARTIALLY CONSISTENT until Daily Play / Tournament migrate.
