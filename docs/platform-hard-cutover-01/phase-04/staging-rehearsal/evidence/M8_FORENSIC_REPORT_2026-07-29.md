# M8 Forensic Report — PLATFORM-HARD-CUTOVER-01 Phase 4

**Mode:** READ-ONLY  
**Target:** Staging `qyewbxjsiiyufanzcjcq`  
**Production blocked:** `expuvcohlcjzvrrauvud`  
**Marker:** `PLATFORM_HARD_CUTOVER_01_M8_FORENSIC_READ_ONLY`  
**Database mutations this turn:** `0`  
**Production mutations:** `0`

## 1. Current baseline (live)

| Layer | Live state |
|-------|------------|
| Tables | 8/8 `competition_ssot_*` present |
| `tenant_id` | `text` on all 8 |
| Row counts | all `0` |
| Secondary indexes (20) | **6/6 present** |
| RLS enabled | true on all 8 |
| RLS forced | true on all 8 |
| Policies | **12 present** (match `30_RLS.sql`) |
| RPC / functions | **0** |
| anon grants | **0** (revoked) |
| authenticated grants | ALL table privileges on all 8 |
| service_role grants | ALL on all 8 |

### Migration history (`hard_cutover_m8_*`)

| version | name | reflects reality? |
|---------|------|-------------------|
| 20260728011027 | `..._10_tables` | Partial (tables exist after recreate) |
| 20260728011054 | `..._20_indexes` | **Stale** (pre-rollback) |
| 20260728011549 | `..._90_rollback_incomplete` | **Stale marker** |
| 20260729121909 | `..._20_indexes_reapply_text_tenant` | True |
| 20260729122037 | `..._30_rls_text_tenant` | True |

### Important correction vs Owner assumed snapshot

Owner assumed “0 indexes / 0 policies / anon grants present / prior mutations = 0”.  
Live forensic shows that assumption is **stale**: a prior interrupted apply turn already applied `20` reapply + `30` RLS. This forensic turn did **not** mutate.

## 2. Drift matrix vs authored package

| Authored file | Expected | Live | Verdict |
|---------------|----------|------|---------|
| `10_TABLES.sql` | 8 tables, text `tenant_id`, constraints | Present, text, constraints OK | **MATCH** |
| `20_INDEXES.sql` | 6 secondary indexes | 6 present | **MATCH** |
| `30_RLS.sql` | ENABLE+FORCE, policies, REVOKE anon | Present | **MATCH** |
| `40_RPC_COMMAND_AND_FINALIZE.sql` | 3 SECURITY DEFINER RPCs (text `p_tenant_id`) | 0 functions | **MISSING** |
| `50_GRANTS.sql` | Narrow authenticated grants + service_role ALL + seq USAGE/SELECT | authenticated still has excess DELETE/TRUNCATE/etc; anon OK | **PARTIAL** |
| `90_ROLLBACK.sql` | Drop functions+tables | Objects still present | N/A (not applied now) |
| `99_VERIFY.sql` | Read-only cert | Not run | **NOT_RUN** |

### Objects đúng / thiếu / thừa

- **Đúng:** tables, columns/types, constraints, 6 indexes, RLS force, 12 policies, anon revoked, empty rows.
- **Thiếu:** 3 RPC (`append_command`, `upsert_working_score`, `finalize_match_result`); intended narrow authenticated grants; `99_VERIFY` certification.
- **Thừa / stale:** migration records `..._20_indexes` (20260728) và `..._90_rollback_incomplete` không còn mô tả đúng hiện trạng object.
- **Không thừa object runtime:** không có RPC uuid legacy; không có policy lạ ngoài package.

## 3. Security exposure

| Exposure | Severity | Notes |
|----------|----------|-------|
| anon table grants | **Mitigated** | 0 grants after `30_RLS` revoke |
| authenticated excess privileges | **Medium (mitigated by FORCE RLS)** | Table-level DELETE/TRUNCATE wider than `50_GRANTS`; policies block most client writes (esp. finalized restrictive denies) |
| Missing finalize RPC | **High for cutover readiness** | Single-writer path not installed → M8 incomplete |
| Stale migration markers | **Low operational** | Confusing for operators; not a live privilege hole |

## 4. Recommended remediation (NOT executed)

**Chọn đúng một path: B — Targeted reconciliation, không DROP tables.**

Lý do B an toàn hơn A lúc này:

1. Schema `10` đã đúng text-tenant và rỗng.
2. `20` + `30` đã MATCH authored.
3. `90_ROLLBACK` sẽ DROP 8 bảng đúng — rủi ro không cần thiết khi chỉ thiếu `40`/`50`.
4. Path A chỉ đáng xét nếu Owner muốn “migration history sạch tuyệt đối”; hiện tại history stale nhưng object đúng.

### Path B exact sequence (Owner GO riêng trước khi chạy)

1. Apply authored `40_RPC_COMMAND_AND_FINALIZE.sql`
2. Apply authored `50_GRANTS.sql`
3. Run read-only `99_VERIFY.sql` → PASS required
4. **STOP** — xin Owner GO riêng cho wipe / DROP `club_ai_data` / reseed

### Optional tighten (Owner quyết định)

`50_GRANTS.sql` chỉ `GRANT`, không `REVOKE` privilege thừa của `authenticated`.  
Nếu muốn khớp tuyệt đối privilege matrix, cần thêm **một snippet authored** (file mới, Owner-approved) để REVOKE DELETE/TRUNCATE/TRIGGER/REFERENCES thừa, rồi mới certify. Không invent SQL ad-hoc trong rehearsal.

### Path A (không khuyến nghị lúc này)

`90_ROLLBACK.sql` → re-apply `10→50` + `99_VERIFY`.  
Chỉ dùng nếu Owner GO yêu cầu reset sạch history/object.

## 5. Exact files

**Dùng sẵn:**

- `docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/40_RPC_COMMAND_AND_FINALIZE.sql`
- `docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/50_GRANTS.sql`
- `docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/99_VERIFY.sql`

**Không chạy trong remediation B:**

- `90_ROLLBACK.sql`
- `10_ORDERED_WIPE.sql`
- `20_DROP_CLUB_AI_DATA.sql`
- reseed package

**Có thể tạo sau (Owner GO):**

- optional `51_GRANTS_TIGHTEN.sql` (REVOKE excess authenticated privileges to match intended matrix)

**Evidence vừa tạo (chưa commit):**

- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/M8_FORENSIC_BASELINE_2026-07-29.json`
- `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/M8_FORENSIC_REPORT_2026-07-29.md`

## 6. Owner GO cần thiết

1. **Xác nhận baseline forensic này** (đặc biệt: `20`+`30` đã live, khác snapshot cũ).
2. **GO cho Path B only:** apply `40` → `50` → run `99_VERIFY`.
3. Quyết định có cần optional grants-tighten sau `50` hay không.
4. **Không** cấp GO wipe/DROP/reseed cho đến khi `99_VERIFY` PASS.
