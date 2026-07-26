# COACHING-04 — localStorage Retirement Certification

**Status:** CERTIFIED (path semantics)  
**Verdict:** `COACHING_04_LOCALSTORAGE_RETIREMENT_CERTIFIED`  
**CODEX_DELETE_ALLOWED:** `NO`

## Semantics (closure contract)

`localStorageRetired=true` in this certification means **only**:

> On the certified Staging Preview durable runtime path, coaching collections do **not** read or write `pickleball-coaching-v1::{clubId}` and do **not** silently fall back to localStorage.

It does **not** mean:

- deletion of `createLegacyCoachingAdapter`;
- deletion or wipe of browser localStorage user data;
- flipping Production behavior;
- flipping compile-time `LOCALSTORAGE_RETIRED` to activate destructive retirement.

Compile-time `LOCALSTORAGE_RETIRED` remains **`false`** so legacy rollback adapter and detect/classify helpers stay available.

## Certified evidence pins

| Pin | Value |
|-----|-------|
| Certified Preview | `https://pickleball-scheduler-q1sjbac73-pickleball-scheduler.vercel.app` |
| Preview commit | `361d61cb6ed8cecdb50ee9f94f7240d5bb47ff23` |
| Smoke | `COACHING_04_STAGING_RUNTIME_ACTIVATED_SMOKE_PASS` |
| Durable gate | ACTIVE (`staging` + durable flag + Owner GO flag) |
| `COACHING_DURABLE_RUNTIME_DEFAULT` | `false` |
| Code `LOCALSTORAGE_RETIRED` | `false` |
| Legacy adapter retained | `true` |
| Browser data deleted | `false` |
| Production untouched | `true` |

## Guards verified

1. Staging durable runtime ACTIVE on certified Preview.
2. Durable adapter does not call `localStorage.getItem/setItem/removeItem`.
3. Durable adapter does not import `coachingService`.
4. Durable failure emits `silent_fallback_blocked` — no silent success via legacy.
5. PLAYER `mappingRows=0` → `UNMAPPED`.
6. COACH assignment scope fail closed (missing scope/actor → ERROR, not invent).
7. Production refuse: `VITE_APP_ENV=production|prod` → `production-not-authorized`.
8. Rollback: unset Staging flags (`VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED` and/or `VITE_COACHING_STAGING_OWNER_GO_GRANTED`) → legacy composition; **no database rollback**.

## Rollback (retained)

| Switch | Effect |
|--------|--------|
| Unset durable / Owner GO Staging flags | Default composition → legacy |
| `createCoachingRuntime({ mode: "legacy" })` | Explicit legacy |
| Keep `COACHING_DURABLE_RUNTIME_DEFAULT=false` | Non-Staging / Production builds stay legacy |

## Non-actions

- No SQL / DDL / DML.
- No mapping-row creation.
- No browser key deletion.
- No Production rollout.
- No adapter file deletion.
