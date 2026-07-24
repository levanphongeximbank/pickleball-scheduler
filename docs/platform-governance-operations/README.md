# Platform Governance & Operations (PGO)

**Workstream:** PGO-01 — Platform Governance & Operations Registry
**Scope:** Documentation only
**Branch:** `feature/pgo-01-platform-governance-operations-registry`
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\platform-governance-operations-pgo-01-registry`
**Fresh `origin/main` (snapshot):** `f599f7e81ad938ea7f16b3c8b4eaa685e763bbc4`
**Snapshot timestamp:** `2026-07-24T17:11:17+07:00`
**Package version on tip:** `5.3.36`

## Mục tiêu PGO

Xây dựng lớp **Platform Governance & Operations** cho PICK_VN: đăng ký worktree/branch song song, bản đồ collision file dùng chung, sổ theo dõi rollout/deferred, ma trận authority môi trường, và phân quyền CI/CD — để Owner và agent vận hành song song mà không đụng Platform Core, Competition Engine, hay business module đang active.

PGO **không** chứa business rules (điểm, bracket, billing logic, pairing rules, v.v.).

## Phạm vi Governance

- Ownership boundary giữa workstream / module / shared surfaces.
- Inventory active worktree + branch + HEAD + clean/dirty.
- Shared-file collision map và approval gate trước khi sửa shared path.
- Rollout / deferred track register (kể cả track bị Owner đóng).
- Quy tắc fresh `origin/main` và cấm tự cleanup worktree khác.

## Phạm vi Operations

- Environment & authority matrix (Local → Production): configuration / deployment / secret authority.
- CI/CD & release authority: verification gate vs deployment authority.
- Evidence ownership cho release, approval, rollback.
- Hygiene flags (stale local `main`, dirty shared files) — ghi nhận, không tự sửa ngoài path được phép.

## Ownership boundary

| Layer | Owner | PGO role |
|-------|--------|----------|
| PGO docs (`docs/platform-governance-operations/**`) | Owner GO + PGO workstream | Registry SSOT |
| Platform Core | Platform Core owner | Ngoài scope PGO-01 |
| Competition Engine | Competition owner | Ngoài scope PGO-01 |
| Business modules | Module owners | Ngoài scope PGO-01 |
| Shared CI (`.github/**`, `scripts/ci/**`) | CI / Foundation owner | Chỉ ghi collision; **không** sửa trong PGO-01 |
| Deployment (Vercel Git Integration) | Deployment authority | Chỉ ghi evidence; **không** deploy từ PGO-01 |
| Secrets / env values | Secret authority + Owner GO | Chỉ tên biến; **không** ghi giá trị |

## Không chứa business rules

Registry PGO chỉ mô tả **cách vận hành song song an toàn**. Không định nghĩa luật giải, Elo, subscription SKU, notification delivery policy, hay schema nghiệp vụ.

## Trạng thái PGO-00 và PGO-01

| Phase | Trạng thái | Ghi chú |
|-------|------------|---------|
| **PGO-00** Read-Only Audit | Hoàn tất | Verdict `PGO_00_READ_ONLY_AUDIT_PASS_WITH_GAPS`; Owner GO cho PGO-01 **GRANTED** |
| **PGO-01** Registry | Documentation-only implementation | Path `docs/platform-governance-operations/**` only; no commit/push/PR trong lần chạy implementation |

Inventory PGO-01 **re-cut** từ fresh `origin/main` và `git worktree list` tại snapshot — không copy mù số lượng worktree từ audit PGO-00 nếu đã đổi (PGO-00 ghi ~47; snapshot PGO-01 = **46**).

## Mục lục tài liệu

| File | Nội dung |
|------|----------|
| [00_PGO_00_READINESS_AUDIT_SUMMARY.md](./00_PGO_00_READINESS_AUDIT_SUMMARY.md) | Tóm tắt audit PGO-00 và remediation được chọn |
| [01_ACTIVE_WORKTREE_AND_BRANCH_REGISTRY.md](./01_ACTIVE_WORKTREE_AND_BRANCH_REGISTRY.md) | Inventory worktree / branch / HEAD / dirty / collision |
| [02_SHARED_FILE_COLLISION_MAP.md](./02_SHARED_FILE_COLLISION_MAP.md) | Shared zones, mức HIGH/MEDIUM/LOW, ownership gate |
| [03_ROLLOUT_AND_DEFERRED_TRACK_REGISTER.md](./03_ROLLOUT_AND_DEFERRED_TRACK_REGISTER.md) | Staging/Production/deferred tracks + Notification 2C |
| [04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md](./04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md) | Local…Production authority matrix |
| [05_CI_CD_AND_RELEASE_AUTHORITY.md](./05_CI_CD_AND_RELEASE_AUTHORITY.md) | GitHub Actions verify vs Vercel deploy |
| [06_PGO_01_CERTIFICATION_CHECKLIST.md](./06_PGO_01_CERTIFICATION_CHECKLIST.md) | Checklist đóng PGO-01 |

## Hard constraints (PGO-01)

- Chỉ tạo/sửa dưới `docs/platform-governance-operations/**`.
- Không sửa Platform Core, Competition Engine, business modules, Notification Phase 2C, `.github/**`, `scripts/ci/**`, package/lockfiles, Supabase, secrets, deployment config.
- Notification Production Phase 2C = **`DEFERRED_BY_OWNER`** — không đề xuất mở lại.
- Không deploy, không migration, không cleanup worktree khác.
