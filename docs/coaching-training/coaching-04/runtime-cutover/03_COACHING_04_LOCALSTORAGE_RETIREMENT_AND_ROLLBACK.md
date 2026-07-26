# COACHING-04 — localStorage Retirement & Rollback

## Can we retire fallback while keeping rollback adapter?

**Yes.** Design already separates:

1. **No silent fallback** — durable failures never succeed via localStorage.
2. **Rollback adapter retained** — `createLegacyCoachingAdapter` + `mode: "legacy"` remain available.
3. **Retirement flag** — `LOCALSTORAGE_RETIRED` stays `false` until a dedicated Owner GO.

## Controlled retirement (future — not this phase)

Owner token: `COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT`

Preconditions:

1. Staging durable runtime certified for COACH/admin flows in scope.
2. Operator export of `pickleball-coaching-v1::*` completed.
3. Explicit typed discard confirmation.
4. Separate PR setting `LOCALSTORAGE_RETIRED=true` (adapter may stub-throw; do not delete in same step without Owner scope expansion).

## Rollback switch (always available this phase)

| Switch | Effect |
|--------|--------|
| Unset `VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED` | Default composition → legacy |
| `createCoachingRuntime({ mode: "legacy" })` | Explicit legacy |
| Keep `COACHING_DURABLE_RUNTIME_DEFAULT=false` | Production builds stay legacy |

## This package phase (historical cutover authoring)

`LOCALSTORAGE_RETIREMENT` GO for **destructive** retirement (adapter stub / key wipe) **not granted**. No key deletion. No silent upload.

## Certified path retirement (COACHING-04 closure)

See `../localstorage-retirement/00_COACHING_04_LOCALSTORAGE_RETIREMENT_CERTIFICATION.md`.

Closure contract `localStorageRetired=true` means the **active Staging durable path** no longer uses localStorage. Compile-time `LOCALSTORAGE_RETIRED` remains `false`; legacy adapter retained for rollback.
