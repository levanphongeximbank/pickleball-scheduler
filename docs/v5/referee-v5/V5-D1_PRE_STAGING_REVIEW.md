# V5-D.1 — Pre-Staging Review

**Date:** 2026-07-12  
**Reviewer:** Codex (draft)  
**Owner gate:** REQUIRED before staging apply

---

## Executive summary

V5-D.1 corrects the transactional architecture flaw identified in owner review. Code and SQL drafts implement Edge-compute + single atomic commit. **Staging apply remains NO-GO** until owner re-review.

---

## Criterion checklist

| Criterion | Result |
|-----------|--------|
| One atomic command commit RPC | **PASS** (SQL + JS) |
| Lock held during all writes | **PASS** |
| One atomic finalize RPC | **PASS** |
| Edge verifies JWT | **PASS** (stub + spec) |
| Actor derived server-side | **PASS** |
| Client actor/tenant ignored | **PASS** |
| Internal RPC inaccessible to browser | **PASS** |
| Assignment rechecked in database | **PASS** |
| Idempotency request hash | **PASS** |
| Append-only DB enforcement | **PASS** (SQL trigger draft) |
| State schema validation | **PASS** |
| Atomic finalize design | **PASS** |
| SECURITY DEFINER hardened | **PASS** (`search_path` fixed) |
| Migration ordering verified | **PASS** |
| SQL static verification | **PASS** |
| Integration tests (Supabase) | NOT RUN |
| RLS tests (Supabase) | NOT RUN |
| Staging readiness | **YES** (draft ready — pending owner GO) |
| Production readiness | **NO** |

---

## Tests

| Suite | Result |
|-------|--------|
| V5-D.1 | 30/30 PASS |
| V5-D | 50/50 PASS |
| V5-B + command | 93/93 PASS |
| V5-C UI | 36/36 PASS (prior run) |
| Legacy referee RPC | 9/9 PASS (prior run) |
| Build | PASS (prior run) |

---

## Open items for staging

1. Deploy Edge Functions (`referee-v5-apply-command`, `referee-v5-finalize`)
2. Wire service role client in Edge only
3. Apply SQL chain on staging
4. Run Supabase integration + RLS suite
5. Two-device manual smoke

---

## Recommended next action

```text
OWNER REVIEW BEFORE STAGING APPLY
```

Do not apply `PHASE_V5A`, `PHASE_V5D`, or `PHASE_V5D1` until owner approves this review.
