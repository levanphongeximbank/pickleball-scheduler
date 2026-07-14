# Phase 42N — Preview/Staging Safety Gate Report

**Date:** 2026-07-14  
**Branch:** `hotfix/v2-athlete-membership-ssot`  
**Commit:** `e33494f4dd5a0cf32490234d47c9b7c87eb4d862`  
**Verdict:** **BLOCKED — PREVIEW/STAGING ISOLATION NOT SAFE**

---

## 1. Base branch

| Item | Value |
|------|-------|
| Current branch | `hotfix/v2-athlete-membership-ssot` |
| Forked from | `origin/main` @ `d44dc0c` |
| Merge-base with `main` | `d44dc0cd2e4eb15ded1c27f8fab34dcc5b435ed8` |
| Ahead / behind `main` | **1 ahead / 0 behind** |
| GitHub HEAD | `main` |
| Merge-base with `origin/v5-platform-edition` | `2ff3838…` (divergent) |
| On `v5-platform-edition` not in hotfix/main | 3 commits (club V2 UI SoT hotfixes: `e7eda71`, `894b058`, `80f103b`) |

**PR base đề xuất:** `main` (GitHub default; hotfix đã tách từ đây).

**Rủi ro Phase 42:** Foundation Club Storage V2 **có trên main**. 3 commit club UI gần đây chỉ trên `v5-platform-edition` (chưa vào main) — không chặn 42N athlete link, nhưng Owner cần biết Production từng deploy Phase 42M từ `v5-platform-edition`. **Không rebase/merge** các nhánh đó trong Safety Gate này.

**Không mở PR vào `v5-platform-edition`** trừ khi Owner chỉ định — GitHub HEAD hiện là `main`.

---

## 2. Preview database isolation

| Environment | App URL | Supabase project | Đánh giá |
|-------------|---------|------------------|----------|
| Production | `pickleball-scheduler-eight.vercel.app` | `expuvcohlcjzvrrauvud` | Production |
| Preview | *(chưa có PR build cho hotfix)* | **Không đọc được value** | **UNVERIFIED** |
| Staging target | — | `qyewbxjsiiyufanzcjcq` | Staging (có trong `.env.staging-qa.local`) |
| Local staging env | — | `qyewbxjsiiyufanzcjcq` | Staging |

**Evidence:**
- `vercel env ls preview` → biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLUB_STORAGE_V2`, `VITE_RBAC_ENABLED`, `SUPABASE_URL` **có tồn tại** (Encrypted).
- `vercel env pull --environment preview` → values **EMPTY** (token/CLI không decrypt Sensitive).
- Không thể chứng minh Preview ≠ `expuvcohlcjzvrrauvud`.

**Kết luận Gate 2:** **FAIL / UNVERIFIED** — không đủ bằng chứng Preview dùng Staging.  
→ **Không apply SQL Staging cho mục đích Preview QA.**  
→ **Không Owner QA trên Preview** cho đến khi Owner xác nhận Dashboard.

**Owner action bắt buộc (Dashboard):**

1. Vercel → Project → Settings → Environment Variables → **Preview**  
2. Confirm `VITE_SUPABASE_URL` = `https://qyewbxjsiiyufanzcjcq.supabase.co`  
3. Nếu đang là `expuvcohlcjzvrrauvud` → **đổi sang Staging** trước mọi apply/QA.

Tài liệu lịch sử (Phase 23E/42J) kỳ vọng Preview = Staging, nhưng không thay thế live verification.

---

## 3. Staging Supabase

| Item | Value |
|------|-------|
| Staging project ref | `qyewbxjsiiyufanzcjcq` |
| Staging URL | `https://qyewbxjsiiyufanzcjcq.supabase.co` |
| `athletes` | Có — **0 rows** |
| `club_members` | Có — **26** active total |
| `club_data_v3` | Có — 1 row |
| `platform_resolve_athlete_profile` | **Chưa có** (RPC 42N chưa apply) |
| Hương Nguyễn | **Không** có trên Staging |

### Staging dry-run (read-only, chưa apply)

| Metric | Value |
|--------|-------|
| Memberships cần link (`active` + `athlete_id` null) | **26** |
| Distinct users | **8** |
| Athletes đã có | **0** |
| Athletes sẽ tạo | **8** |
| Memberships sẽ update | **26** |
| Users multi-club trong set | **4** (1 user có 16 memberships — phù hợp 1 athlete nhiều membership) |
| Pending requests | 8 |

Fixture: có thể dùng member Staging existing (null athlete) — **không** copy Production Hương.

---

## 4. SQL review — `PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql`

| Check | Result |
|-------|--------|
| Transaction cho backfill | **Có** (`BEGIN`…`COMMIT` quanh UPDATE) |
| Idempotent | **Có** (filter `athlete_id IS NULL`; ensure returns existing; unique partial; 2nd run no-op) |
| Athlete ID | `gen_random_uuid()` default PK |
| Unique | `athletes_user_uniq` on `user_id` **WHERE user_id IS NOT NULL** |
| User already has athlete | SELECT first → return; race → `unique_violation` catch |
| Multi-club | Same `athlete_id` set on each null membership for that user |
| Missing name/email | Fallback `display_name` → `email` → `user_id::text` |
| Reads `auth.users`? | **Không** — chỉ `profiles` + `club_members` + `athletes` |
| SECURITY DEFINER | Yes on ensure + resolve + patched review |
| `search_path` | `set search_path = public` |
| RPCs created/changed | `phase42n_ensure_athlete_for_user`, `platform_resolve_athlete_profile`, replace `club_review_membership_request`, replace `club_list_members` |
| Grants | ensure → **service_role only**; resolve/review/list_members → **authenticated**; revoke anon/authenticated on ensure |
| RLS | No policy DROP/CREATE on tables; mutate via definer; SELECT policies Phase 42C giữ |
| Destructive | **Không** DROP TABLE/TRUNCATE; không DELETE membership |
| Không ghi `profiles.club_id` | **PASS** |
| Không tạo `club_data_v3` | **PASS** |
| Không ghi Pick_VN | **PASS** |
| Không đổi membership status / không tạo membership mới (trừ review patch khi approve future) | Backfill: **PASS**; review path only on future approve |

**SQL content review:** PASS (nội dung).  
**Apply Staging:** **HOLD** đến khi Preview isolation PASS.

---

## 5. PR / Preview / Apply / Owner QA

| Step | Status |
|------|--------|
| PR tạo | **Chưa** (`gh` không có; branch đã push). Compare: https://github.com/levanphongeximbank/pickleball-scheduler/compare/main...hotfix/v2-athlete-membership-ssot?expand=1 |
| Preview URL | **Chưa** (cần PR) |
| Preview commit | N/A |
| Preview Supabase ref chứng minh | **UNVERIFIED** |
| Staging SQL apply | **NOT RUN** |
| Staging auto QA | **NOT RUN** (blocked) |
| Tests (local commit) | 2268 pass / build OK (đã ghi trong deliverable trước) |

---

## Verdict

# BLOCKED — PREVIEW/STAGING ISOLATION NOT SAFE

**Lý do:** Không đọc được `VITE_SUPABASE_URL` Preview thực tế; không chứng minh Preview ≠ Production (`expuvcohlcjzvrrauvud`). Theo Gate: không apply SQL, không Owner QA Preview.

### Owner cần làm (ngắn)

1. Vercel Dashboard → xác nhận Preview `VITE_SUPABASE_URL` = Staging `qyewbxjsiiyufanzcjcq`.
2. Nếu đúng Staging → báo lại → Codex mới được: mở/hoàn tất PR → Preview URL → apply SQL Staging → auto QA → READY FOR OWNER QA.
3. Nếu đang Production → đổi Preview sang Staging trước.

**STOP:** Không merge · Không migrate Production · Không deploy Production · Không sửa dữ liệu Production.
