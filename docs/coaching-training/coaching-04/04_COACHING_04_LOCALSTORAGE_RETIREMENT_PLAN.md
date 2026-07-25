# COACHING-04 — localStorage Retirement Plan

**Status:** Plan only  
**Flag this step:** `LOCALSTORAGE_RETIRED=false`  
**Service:** `src/features/coaching/services/coachingService.js`  
**Key prefix:** `pickleball-coaching-v1::{clubId}`

---

## Schema (`pickleball-coaching-v1`)

Per-club JSON blob:

```json
{
  "clubId": "<clubId>",
  "coaches": [],
  "students": [],
  "classes": [],
  "schedule": [],
  "packages": [],
  "attendance": [],
  "evaluations": [],
  "updatedAt": "<iso>"
}
```

Notes:

- Club-keyed only — **no tenant stamp** (isolation risk vs canonical `tenant_id` + `club_id`).
- Entity shapes are prototype (embedded names/ids), not COACHING-02 typed references.
- Classification: `COMPATIBILITY_ONLY` (`COMPATIBILITY.md`).

---

## Consumers

| Consumer | Path | Use |
|----------|------|-----|
| Legacy service | `services/coachingService.js` | load/save CRUD |
| Barrel re-exports | `src/features/coaching/index.js` | UI import surface |
| Entity pages | `src/pages/coaching/*` | list/save/delete via barrel |
| Menu | `src/config/v5Menu/clubCoachingMenu.js` | routes only |
| Tests / harness | various | may call LS helpers |

Canonical `domain/` / `application/` / `repositories/` / `persistence/` **must not** import the LS service.

---

## Risks

| Risk | Impact |
|------|--------|
| Silent upload of LS → durable | Can corrupt tenant/club typed data; forge coach/player ids |
| Silent delete of LS before export | Irrecoverable operator data loss |
| Dual-write divergence | Two SoTs; support nightmare |
| Treating LS ids as `coach_reference_id` / `player_id` | Authz bypass or orphan rows |
| Retiring while `COACHING_DURABLE_RUNTIME_DEFAULT=false` | UI breaks with no backend |
| PLAYER durable cutover before mapping SoT | False self-scope security |

---

## Retirement procedure (future Owner GO)

### Preconditions

1. Durable SQL applied and certified (COACHING-02/03/04 as required).
2. UI pages on `durable` (or explicitly decommissioned) for all admin/coach flows in scope.
3. `LOCALSTORAGE_RETIRED` still false until step 6.
4. Operator confirmation UI completed.

### Steps

1. **Inventory** keys matching `pickleball-coaching-v1::`.
2. **Export** — download JSON per club (user-visible confirmation).
3. **Optional assisted migrate** — only under explicit Owner tool + mapping rules (out of band; not silent).
4. **Discard confirmation** — typed confirm (club id + “DELETE LOCAL COACHING DATA”).
5. **Remove keys** — only after confirm; log local audit event if available.
6. Set **`LOCALSTORAGE_RETIRED=true`** in code/config in a dedicated PR.
7. Keep `coachingService.js` stub throwing “retired” OR delete in a later cleanup PR (COMPATIBILITY rule: do not delete until Owner expands scope).

### Explicit prohibitions this step

- No silent upload to Supabase.
- No silent `localStorage.removeItem`.
- No setting `LOCALSTORAGE_RETIRED=true` in this authoring pack.
- No changing default runtime to durable as a side effect of “retirement planning.”

---

## This-step constants

| Constant | Value |
|----------|-------|
| `LOCALSTORAGE_RETIRED` | `false` |
| `COACHING_DURABLE_RUNTIME_DEFAULT` | `false` |
| LS service file | retained |
| Export/discard UI | not built in this pack (plan only) |
