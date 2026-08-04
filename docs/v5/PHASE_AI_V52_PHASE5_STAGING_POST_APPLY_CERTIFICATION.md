# Phase AI V5.2 — Staging Post-Apply Certification

**Ngày chứng nhận:** 2026-08-04  
**Target duy nhất:** Supabase Staging `qyewbxjsiiyufanzcjcq`  
**Production cấm:** `expuvcohlcjzvrrauvud`  
**Verdict:** `PHASE5_STAGING_POST_APPLY_CERTIFIED_WITH_OBSERVATIONS`  
**Mức hoàn tất Phase 5:** **100%**

## 1. Safety và repository baseline

- Target được chứng minh trước DB query bằng Edge Function entrypoint chứa `user_fn_qyewbxjsiiyufanzcjcq`.
- `current_user = postgres`.
- Không truy cập hoặc mutate Production.
- Branch: `fix/phase5d-br01-br10-local-closure`.
- HEAD: `e21ead54efeb642f963c3421dedc9c283d704037`.
- `origin/main`: `42d7a34887f77494103a34e77d58dfa365ed7708`.
- Branch hiện tại đi trước `origin/main` 6 commit, không đi sau.
- `.codex/` là untracked có sẵn; certification không sửa thư mục này.
- `package.json` và `package-lock.json` giữ nguyên SHA-256 trước/sau `npm ci`.

## 2. Exact Phase 5 scope

- SQL: `docs/v5/PHASE_AI_V52_PHASE5.sql`
- Rollout: `docs/v5/PHASE_AI_V52_ROLLOUT.md`
- Manual QA: `docs/v5/PHASE_AI_V52_MANUAL_QA.md`
- Staging smoke: `scripts/verify-ai-v52-staging-smoke.mjs`
- Runtime scope: AI workflow checklist, Court Engine Realtime, AI/club cloud sync và club version conflict.

## 3. Database verification — read-only

| Hạng mục | Kết quả |
|---|---|
| Migration history | `phase_ai_v52_phase5`, version `20260804011017` — PASS |
| `ai_workflow_checklists` | Tồn tại — PASS |
| Columns/default/nullability | Đúng 7 cột theo package — PASS |
| Constraints | PK `id`; UNIQUE `(tenant_id, tournament_id, item_key)` — PASS |
| RLS | Enabled — PASS |
| Policies | Đúng 3 policy INSERT/SELECT/UPDATE cho `authenticated`; không có policy thừa — PASS |
| Indexes | PK, unique constraint index và tenant/tournament index đều valid + ready — PASS |
| Realtime publication | Đủ `ai_workflow_checklists`, `court_engine_active_sessions`, `court_engine_stores` — PASS |
| `club_data_v3.version` | `integer NOT NULL DEFAULT 0` — hợp lệ |
| Smoke residue | 0 row trên cả 3 bảng smoke — PASS |
| Advisor cho checklist mới | 0 security lint; 0 performance lint — PASS |

Ghi chú: `club_data_v3.version` đã tồn tại với default `0`; câu lệnh `ADD COLUMN IF NOT EXISTS ... DEFAULT 1` của Phase 5 không thay default đang có. Kiểu và nullability đáp ứng contract version hiện hành.

## 4. Code validation

| Gate | Kết quả |
|---|---|
| `npm ci` | PASS; 644 packages added, 645 audited |
| `npm run ci:foundation-lock` | PASS |
| `npm run lint:no-new` | PASS — 0 new violation |
| Focused Phase 5 tests | PASS — 66/66 |
| `npm run build` | PASS |
| Secret scan | PASS — 8,858 tracked files; 0 suspicious file |
| `git diff` / `git diff --cached` trước evidence | Sạch |
| Package/lock hashes | Không đổi |

Focused tests:

- `tests/ai-assistant-sprint7.test.js`
- `tests/ai-auto-sync.test.js`
- `tests/cloud-sync.test.js`
- `tests/court-engine-cloud.test.js`
- `tests/court-engine.test.js`

## 5. Observations

1. `list_branches` vẫn trả `Project reference is missing when validating permissions`. Công cụ tồn tại nhưng riêng Branching permission validation thiếu project ref; đây là observation non-blocking và không ảnh hưởng database certification.
2. Staging smoke CLI yêu cầu local Staging URL + service-role key. Local env không đáp ứng nên CLI dừng ở ENV; verification tương đương được thực hiện bằng DB read-only và xác nhận residue bằng 0.
3. `npm ci` báo 20 dependency vulnerabilities hiện hữu: 5 moderate, 15 high. Không chạy `npm audit fix` để tránh đổi package/lock ngoài scope.
4. Build PASS nhưng có warning hiện hữu về large chunks và `node:crypto` browser externalization.
5. Advisor có finding hiện hữu trên các object rộng hơn như `club_data_v3`/`court_engine_stores`; không có finding nhắm vào `ai_workflow_checklists` và certification không sửa các object đó.

## 6. Mutation accounting

- Database mutations trong lượt certification: **0**.
- Production mutations: **0**.
- Migration apply/re-apply: **0**.
- Branch merge: **0**.

## 7. Verdict và Owner handoff

`PHASE5_STAGING_POST_APPLY_CERTIFIED_WITH_OBSERVATIONS`

Phase 5 Staging post-apply đạt **100%**. Owner cần review hai evidence artifact, quyết định có đưa evidence lên PR riêng hay không, và theo dõi riêng dependency audit/Branching MCP configuration. Không cần apply lại Phase 5 migration.
