# Private Pairing Rules Engine V2 — Security Model

| Field | Value |
|-------|-------|
| Status | PR-4 delivered schema/RLS/RPC (staging apply pending owner GO) |
| Audit findings | [`PRIVATE_PAIRING_RULES_V2_PR1_AUDIT.md`](./PRIVATE_PAIRING_RULES_V2_PR1_AUDIT.md) §6 |
| Spec | [`PRIVATE_PAIRING_RULES_V2_SPEC.md`](./PRIVATE_PAIRING_RULES_V2_SPEC.md) |
| PR-4 detail | [`PRIVATE_PAIRING_RULES_V2_PR4_DATABASE_SECURITY.md`](./PRIVATE_PAIRING_RULES_V2_PR4_DATABASE_SECURITY.md) |
| Apply runbook | [`PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md`](./PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md) |

---

## 1. Threat model (summary)

| Threat | Current exposure | V2 control |
|--------|------------------|------------|
| Non-admin sees UI | Mitigated by SuperAdminFeatureGate when RBAC on | + dedicated route + permission checks |
| Non-admin calls save on client | Guarded by `guardFounderConstraints` | + RPC with role claim check; never trust UI |
| Role spoof via frontend | Possible if RBAC off or forged local profile | Server JWT role + RLS; flags fail-closed |
| Full club/tournament blob includes rules | **HIGH leak** today (`founderPairingConstraints` on blob) | Strip from normal payloads; dedicated RPC |
| Official draw manipulated silently | Official setup shares Founder panel | Policy block + disclosure + audit |
| Audit readable by club staff | General audit may include PAIRING_OVERRIDE | Separate private_rules audit viewer + perm |
| Realtime channel leak | No dedicated channel yet; blob sync risk | No broadcast of private rules; redact |
| Hard rule bypass via soft scoring | Legacy AI -120 | Unified engine hard reject; flag-gated |

---

## 2. Permission matrix

| Permission | SUPER_ADMIN | All other roles |
|------------|-------------|-----------------|
| `pairing.private_rules.view` | Yes | No |
| `pairing.private_rules.manage` | Yes | No |
| `pairing.private_rules.audit` | Yes | No |
| `pairing.private_rules.simulate` | Yes | No |

Do **not** grant to TECHNICIAN / SYSTEM_TECHNICIAN in this phase (even if they see “Quản trị hệ thống” menus for other tools).

Deprecate reliance on unused `platform.pairing_override` for this feature; map or replace in PR-5 with the four explicit perms.

---

## 3. Layer checklist

| Layer | Requirement | PR |
|-------|-------------|----|
| Sidebar / menu | Visible only with `.view` | PR-5 |
| Route `/admin/ai-pairing/private-rules` | Guard → `403_FORBIDDEN` | PR-5 |
| Component | Fail-closed gate | PR-5 |
| Service (client) | Permission helper; no-op/deny | PR-5 |
| RPC/API | AuthZ on every mutate & read | PR-4 |
| Supabase RLS | Deny all except SUPER_ADMIN (and service role migrations) | PR-4 |
| Realtime | Do not subscribe clients to private rule tables | PR-4 |
| Export | Exclude unless SUPER_ADMIN + explicit export | PR-5/6 |
| Audit log | `.audit` only | PR-4/5 |
| Direct URL | Same as route | PR-5 |
| Tournament/club GET | Never include private rule arrays | PR-4/6 |

Unauthorized responses:

```text
code: 403_FORBIDDEN
message: (generic; no rule details)
```

---

## 4. Tenant isolation

- Every row carries `tenant_id` (and optional club/venue scope ids).
- RLS: `tenant_id` match **and** SUPER_ADMIN platform claim (exact claim design in PR-4).
- Cross-tenant reads fail closed even for SUPER_ADMIN unless using documented break-glass platform mode (if product already has tenant-picker for PLATFORM_ADMIN — reuse that pattern consistently).

---

## 5. Payload redaction policy

Strip / never return:

- `founderPairingConstraints` (legacy) for non–SUPER_ADMIN
- Any `private_pairing_*` nested objects
- Reason text / categories in public APIs
- Simulator explanations
- Soft-delete tombstone details beyond “gone”

Allow SUPER_ADMIN-only endpoints:

- list/get rules, simulate, audit, versions, rollback

---

## 6. Official / certified / VPR ranked

Server must enforce (not UI alone):

1. Load competition class (`OFFICIAL` / `CERTIFIED` / `VPR_RANKED`).
2. Reject apply of personal preference types unless `visibility=disclosed` + reason recorded + audit action `APPLY_PRIVATE_PAIRING_RULESET` with charter reference.
3. Objective regulation constraints (club separation, gender, age, medical approved) remain allowed under disclosed/public as configured.

---

## 7. Feature flags & security

| Flag | Client | Server |
|------|--------|--------|
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | Hide UI | Prefer mirror DB/config flag — deny RPC if off |
| `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` | Engine path | Pairing services must honor server flag |

Frontend flags are **not** a security boundary.

---

## 8. Soft delete & retention

- No hard delete default.
- Retain audit rows; retain archived rule set versions.
- Retention policy: follow platform PII retention for reason_text (may contain sensitive medical notes → restrict view to SUPER_ADMIN + audit perm).

---

## 9. As-is security scorecard (PR-1)

| Control | Score | Note |
|---------|-------|------|
| UI hide | Partial | Good gate; embedded in multi-role pages |
| Client guard | Partial | Role-based; no permission constants used |
| Route isolation | Fail | No dedicated route |
| Storage isolation | Fail | Club/tournament blob field |
| RLS | Fail | No tables |
| RPC AuthZ | Fail | No RPC |
| Official disclosure | Fail | Same panel on Official |
| Hard reject security integrity | Partial | Rules V2 exists; legacy AI penalty path remains |

---

## 10. PR-4 deliverables (status)

| Item | Status |
|------|--------|
| SQL migration `PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql` | Done |
| Tables + indexes + FKs + versioning | Done |
| Permissions seed SUPER_ADMIN only | Done |
| RLS SELECT + deny writes; audit append-only | Done |
| SECURITY DEFINER RPCs + audit | Done |
| Activate Architecture A (PR-2 preflight + hash) | Done |
| Realtime OFF | Done |
| Repository/service adapter (flag-gated) | Done |
| Staging apply | **Pending owner GO** |
| Production apply | Blocked |
| SUPER_ADMIN UI / strip club blob | PR-5 / PR-6 |
