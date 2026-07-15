# Phase 42N — Preview/Staging Safety Gate Report

**Date:** 2026-07-14 (follow-up after Owner Preview env)  
**Branch:** `hotfix/v2-athlete-membership-ssot`  
**Tip commit:** `68c446e` (+ pending commit: tables fallback + staging data backfill script)  
**Verdict:** **BLOCKED — Owner actions remaining (PR + Staging DDL/RPC)**

---

## PASS (completed this gate)

### 1. Base branch
| Item | Value |
|------|-------|
| Forked from | `origin/main` @ `d44dc0c` |
| Ahead / behind `main` | ahead (hotfix tip) / 0 behind |
| PR base | **main** |

### 2. Preview isolation (Owner env + runtime)
| Item | Value |
|------|-------|
| Branch Preview URL | https://pickleball-scheduler-git-hotfix-v2-250ba2-pickleball-scheduler.vercel.app |
| Deployment | `dpl_4eF8GXTU6M2M9nEVNGfZM97mLmns` (`pickleball-scheduler-3wssh2qtv-…`) |
| Target | **preview** / Ready |
| Remote tip | `68c446e24ba432df3efa787fb9dd28005763a48b` |
| JS bundle `qyewbxjsiiyufanzcjcq` | **17 hits** |
| JS bundle `expuvcohlcjzvrrauvud` | **0 hits** |
| `VITE_CLUB_STORAGE_V2` | Owner set `true` (branch Preview) |

**Gate 2: PASS** — Preview runtime project ref = Staging.

### 3. Staging data dry-run + data backfill (service role, Staging only)
Pre:
- memberships_to_link = **26**, distinct_users = **8**, athletes = **0**

Post (idempotent):
- athletes_created = **8**, memberships_linked = **26**
- remaining_null_athlete = **0**, athletes_after = **8**, active_with_athlete = **26**
- Second run: memberships_to_link = **0** (idempotent PASS)
- `club_data_v3` untouched (script does not write blobs)
- `profiles.club_id` not written

Script: `scripts/phase42n-staging-data-backfill.mjs` (ref guard = `qyewbxjsiiyufanzcjcq` only).

### 4. Auto QA (automated)
| Check | Result |
|-------|--------|
| `tests/v2-athlete-membership-ssot.test.js` | **7/7 pass** |
| Prior full suite on feature commit | 2268 pass / build OK |
| Client fallback when RPC missing | PostgREST `profiles` + `athletes` + `club_members` (pending push) |

---

## BLOCKED (remaining)

### A. PR into main
- `gh` installed but **not authenticated** → cannot `gh pr create` from agent.
- No open PR for `hotfix/v2-athlete-membership-ssot` (GitHub API).
- **Owner:** open compare URL or run `gh auth login` then create PR.

Compare: https://github.com/levanphongeximbank/pickleball-scheduler/compare/main...hotfix/v2-athlete-membership-ssot?expand=1

### B. Staging DDL / RPC (full SQL file)
- Supabase MCP: `GetMcpTools` / `mcp_auth` OK, but `execute_sql` / `apply_migration` fail with  
  `Cannot call tool before MCP process client is registered`.
- Data link completed via PostgREST service role; **unique index + RPCs + approve ensure** still need SQL.

**Owner (Staging SQL Editor only — NOT Production):**  
Apply `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` on project `qyewbxjsiiyufanzcjcq`.

Post-SQL checks:
```sql
select to_regprocedure('public.platform_resolve_athlete_profile(uuid)') is not null as rpc_ok;
select count(*) from public.athletes; -- expect 8
select count(*) from public.club_members where status='active' and athlete_id is null; -- expect 0
```

### C. STOP still in force
- No merge  
- No Production SQL  
- No Production deploy  

---

## Owner QA fixtures (Staging — no Hương)
Hương / Production user **không** có trên Staging. Dùng Staging member đã có `athlete_id` sau backfill (8 users / 26 memberships).

Checklist (Preview URL above):
1. Active member → không hiện “Chỉ có tài khoản”; club đúng.
2. Verify skill không yêu cầu blob `players.id`.
3. User không membership → vẫn account-only.
4. Multi-club user → cùng athlete, đổi club không gắn default-club.
5. Route `profile-{uuid}` resolve theo membership, không tạo default-club player.

---

## Verdict until Owner closes A + B

**BLOCKED** for “READY FOR OWNER QA” on full approve-path + PR review track.

**After Owner:** (1) create PR, (2) apply Staging SQL, (3) redeploy Preview if needed → agent can flip to **READY FOR OWNER QA**.

Workaround already live on Staging data + Preview isolation: membership rows are linked; Preview points at Staging. Code tables-fallback (when pushed) allows resolve without RPC until SQL lands.
