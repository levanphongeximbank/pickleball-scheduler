# PGO-04 — Environment, Configuration & Secrets Governance

**Workstream:** PGO-04 — ENVIRONMENT, CONFIGURATION & SECRETS GOVERNANCE
**Scope:** Documentation only (taxonomy, classification, ownership, boundary, validation, drift, flags, authority matrix, readiness gate)
**Owner GO:** GRANTED (read-only evidence audit → documentation-first → **no environment or secret mutation**)
**Branch:** `feature/pgo-04-environment-configuration-secrets-governance`
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\platform-governance-operations-pgo-04-environment-configuration-secrets`
**Fresh `origin/main` (snapshot):** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Local HEAD (snapshot):** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**`origin/main` subject:** Merge pull request #279 — experience-channels-04 public portal list surface data honesty
**`origin/main` date:** `2026-07-25 23:13:04 +0700`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Ahead/behind vs `origin/main`:** ahead **0** / behind **0**

## Mục tiêu

Xây dựng **governance foundation** cho:

1. Environment taxonomy (Local / Development / Test / Staging / Production)
2. Configuration authority and ownership
3. Client-safe vs server-only vs secret classification
4. Secret lifecycle (create / store / distribute / access / rotate / revoke / expire / incident)
5. Browser bundle / `VITE_*` exposure boundary
6. Environment variable validation and fail-closed behavior
7. Configuration drift, change request, Owner GO, rollback, audit trail
8. Feature flag and kill-switch governance
9. External platform authority matrix (GitHub / Vercel / Netlify / Supabase)
10. Environment / configuration / secrets readiness certification model

PGO-04 **chỉ** định nghĩa policy, ownership, classification, evidence requirements và readiness gate.

## Phạm vi

| In scope | Out of scope |
|----------|--------------|
| Taxonomy & authority of environments | Mutating `.env*`, Vercel, Netlify, or Supabase settings |
| Configuration classification & ownership | Creating / rotating / revoking real secrets |
| Secret lifecycle **policy** (no values, no live ops) | Reading or printing secret values |
| Client/server exposure rules | Changing `vercel.json`, `netlify.toml`, workflows, templates |
| Validation & fail-closed **policy** | Implementing new runtime validators in `src/**` / `api/**` |
| Drift / change / approval model | Deploy, migration, SQL/RLS apply |
| Feature-flag governance model | Opening Notification Production Phase 2C |
| External platform authority matrix | Claiming external console settings verified without repo evidence |
| Readiness checklist & verdict vocabulary | Self-certifying Production env/secrets readiness |

## Ownership boundary

| Layer | Owner | PGO-04 role |
|-------|--------|-------------|
| PGO-04 docs (`…/pgo-04-environment-configuration-secrets/**`) | Owner GO + PGO workstream | Environment / config / secrets governance SSOT |
| PGO-01 registry (root `docs/platform-governance-operations/*`) | Owner GO + PGO | Registry / collision / deferred / authority baseline — **read-only** in PGO-04 |
| PGO-02 incident/recovery (`…/pgo-02-incident-recovery-readiness/**`) | Owner GO + PGO | Incident / authority baseline — **read-only** in PGO-04 |
| PGO-03 observability (`…/pgo-03-observability-logging-alerting/**`) | Owner GO + PGO | Logging / redaction baseline — **read-only** in PGO-04 |
| Platform Operations | Platform ops | Execute env/secret ops under documented authority |
| Security | Security Owner | Secret classification, access, rotation/revocation evidence |
| Business Module | Module owners | Module-owned flags/config — not Platform Core by default |
| External Platform | GitHub / Vercel / Netlify / Supabase (+ env authority) | Vendor capability ≠ repository implementation |
| Notification Production Phase 2C | Notification owner + Owner GO | **`DEFERRED_BY_OWNER`** — không mở lại |

## Quan hệ với PGO-01 / PGO-02 / PGO-03

- **PGO-01:** worktree registry, collision map, rollout/deferred register (incl. Notification 2C), environment & CI/CD authority baseline (`04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md`, `05_CI_CD_AND_RELEASE_AUTHORITY.md`).
- **PGO-02:** incident severity, ownership/escalation, rollback/recovery — secret incident handling maps here.
- **PGO-03:** logging / redaction / access — secret values must not appear in logs; redaction rules apply.
- PGO-04 **không** sửa file PGO-01, PGO-02, hoặc PGO-03; chỉ tạo subtree `pgo-04-environment-configuration-secrets/`.

## Không chứa business rules

PGO-04 không định nghĩa luật giải, Elo, subscription SKU, pairing rules, billing logic, notification delivery policy, hay schema nghiệp vụ. Chỉ mô tả **loại cấu hình / secret, ai sở hữu, ranh giới lộ, validation/fail-closed, drift/approval, và gate sẵn sàng**.

## Không mutation môi trường hoặc secret

Trong PGO-04 **cấm**:

- Đọc hoặc in secret value
- Thay environment variable / secret
- Tạo credential / rotate / revoke secret thật
- Sửa `.env*`, environment templates, deploy config
- Kết nối external platform API để verify settings
- Deploy / migration / SQL/RLS
- Commit / push / merge / rebase / reset / clean / stash (trừ khi Owner GO controlled commit sau review)
- `npm install` / `npm update` / `npm audit fix`
- Mở Notification Production Phase 2C

## Document index

| # | File | Purpose |
|---|------|---------|
| 0 | [README.md](./README.md) | Workstream entry, scope, ownership |
| 1 | [01_ENVIRONMENT_TAXONOMY_AND_AUTHORITY.md](./01_ENVIRONMENT_TAXONOMY_AND_AUTHORITY.md) | Environments + authorities + Owner GO |
| 2 | [02_CONFIGURATION_CLASSIFICATION_AND_OWNERSHIP.md](./02_CONFIGURATION_CLASSIFICATION_AND_OWNERSHIP.md) | Client-safe / server-only / env / tenant / external / module |
| 3 | [03_SECRET_CLASSIFICATION_LIFECYCLE_AND_ACCESS.md](./03_SECRET_CLASSIFICATION_LIFECYCLE_AND_ACCESS.md) | Secret lifecycle & access (no values) |
| 4 | [04_CLIENT_SERVER_BOUNDARY_AND_EXPOSURE_RULES.md](./04_CLIENT_SERVER_BOUNDARY_AND_EXPOSURE_RULES.md) | `VITE_*` / browser / server-only rules |
| 5 | [05_ENVIRONMENT_VARIABLE_VALIDATION_AND_FAIL_CLOSED.md](./05_ENVIRONMENT_VARIABLE_VALIDATION_AND_FAIL_CLOSED.md) | Required/optional, validation, fail-closed |
| 6 | [06_CONFIGURATION_DRIFT_CHANGE_AND_APPROVAL.md](./06_CONFIGURATION_DRIFT_CHANGE_AND_APPROVAL.md) | Drift, CR, Owner GO, rollback, audit |
| 7 | [07_FEATURE_FLAG_AND_KILL_SWITCH_GOVERNANCE.md](./07_FEATURE_FLAG_AND_KILL_SWITCH_GOVERNANCE.md) | Flags, kill switch, no security bypass |
| 8 | [08_EXTERNAL_PLATFORM_AUTHORITY_MATRIX.md](./08_EXTERNAL_PLATFORM_AUTHORITY_MATRIX.md) | Repo vs GitHub/Vercel/Netlify/Supabase |
| 9 | [09_PGO_04_READINESS_AND_CERTIFICATION_CHECKLIST.md](./09_PGO_04_READINESS_AND_CERTIFICATION_CHECKLIST.md) | Readiness checklist + snapshot `NOT_READY` |

## Source of truth rules

- Fresh `origin/main` is the evidence baseline for this snapshot.
- Variable **names** and file **paths** only — never values.
- A variable name containing `SECRET` is **not** proof that a secret is exposed.
- External platform capability is **not** “enabled” unless repository evidence exists.
- Module rollout pending ≠ Platform Core defect.
- Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.

## Initial readiness honesty

Initial certification snapshot for environment/configuration/secrets readiness:

```text
VERDICT: NOT_READY
```

Rotation / retention / expiry targets without Owner approval:

```text
PROVISIONAL_NOT_CERTIFIED
```
