# Gate 9 — Source → Production Traceability

**Audit UTC:** 2026-07-27T14:06:33Z  
**Fresh main SHA:** `4c72d4541c7fa111787caeca63d1bf25225a07b9`  
**Rule:** Do not claim unreadable Production environment variables are verified.

## Deployment spine

| Layer | Value | Parity |
|-------|-------|--------|
| Source tip (`origin/main`) | `4c72d4541c7fa111787caeca63d1bf25225a07b9` | — |
| Merge commit (Gate 8 PR #320) | `4c72d4541c7fa111787caeca63d1bf25225a07b9` | equals tip |
| Prior security merge (PR #319) | `1c595fc73ee405e626f46373fe465c8bed338314` | ancestor |
| Prior Staging RLS merge (PR #318) | `df8a1dfb77d8922c871277530ce959ebe4c12478` | ancestor |
| Deployed Production SHA | `4c72d4541c7fa111787caeca63d1bf25225a07b9` | **MATCH** |
| Deployment ID | `5622952921` | success |
| Environment URL (ephemeral) | `https://pickleball-scheduler-1zuprg9g2-pickleball-scheduler.vercel.app` | recorded |
| Production alias | `https://pickvn.app` | smoke PASS |
| Project Production host | `https://pickleball-scheduler-eight.vercel.app` | smoke PASS |
| Evidence timestamp (UTC) | 2026-07-27T14:06:33Z | Gate 9 baseline |

## Route / surface matrix

| Surface | Runtime route | Expected | Observed | Evidence timestamp | Parity status |
|---------|---------------|----------|----------|--------------------|---------------|
| Root | `https://pickvn.app/` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| Clubs directory | `https://pickvn.app/clubs` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| Courts directory | `https://pickvn.app/courts` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| Root (Vercel project host) | `https://pickleball-scheduler-eight.vercel.app/` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| Clubs (Vercel project host) | `…/clubs` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| Courts (Vercel project host) | `…/courts` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| PWA manifest | `https://pickvn.app/manifest.webmanifest` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| PWA service worker | `https://pickvn.app/sw.js` | HTTP 200 | 200 | 2026-07-27T14:06:33Z | PASS |
| Public catalog RPC-backed surfaces | Clubs/Courts LIVE; Tournaments/Rankings LIVE_EMPTY (prior PC/publication evidence) | Honest empty allowed | **Committed evidence** (not re-executed RPC against Prod in Gate 9) | Gate 8 / PC / production-publication docs | PASS_WITH_PRIOR_EVIDENCE |
| Clubs RLS remediation | Production `public.clubs` SELECT policy | `select_policy_count=1`, `writer_policy_count=0`, broad `OR status='active'` removed | Committed `PRODUCTION_POST_APPLY_VERIFY.json` + Owner claim | 2026-07-27T10:22:34Z | PASS_WITH_PRIOR_EVIDENCE (Gate 9 did **not** re-query Production SQL) |
| CI on main tip | GitHub check-runs `verify` | success | success | Gate 9 read | PASS |

## Explicit non-claims

| Item | Status |
|------|--------|
| Production Vercel env **values** | UNREADABLE — not verified |
| Effective Production `VITE_RBAC_ENABLED` | UNREADABLE — code default only |
| Service-role key absence in live env | NOT_VERIFIED via env read |
| Fresh Production SQL policy re-query in Gate 9 | NOT performed (boundary) |

## Source → merge → deploy chain (security + Gate 8)

```text
PR #318 merge df8a1dfb → deploy 5619485800
PR #319 merge 1c595fc7 → deploy 5620947038
PR #320 merge 4c72d454 → deploy 5622952921 (current live)
```

## Overall source-to-Production parity

```text
SOURCE_TO_PRODUCTION_PARITY=PASS
```

Caveat: route HTTP 200 proves shell availability, not full business correctness of every module. Catalog RPC and Clubs RLS rely on committed prior evidence for deep checks.

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_9_SOURCE_TO_PRODUCTION_TRACEABILITY_RECORDED`
