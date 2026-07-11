# CC-01 — Feature Flags

**Phase:** CC-01 | **Date:** 2026-07-11

---

## 1. Flag catalog

| Env key | API helper | Default | Scope |
|---------|------------|---------|-------|
| `VITE_COMPETITION_CORE_ENABLED` | `isCompetitionCoreEnabled()` | `false` | Master gate |
| `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | `isRatingV2Enabled()` | `false` | Rating model V2 (CC-02) |
| `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` | `isDrawV2Enabled()` | `false` | Unified draw (CC-04) |
| `VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED` | `isMatchmakingV2Enabled()` | `false` | Daily / session matchmaking (CC-06) |
| `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` | `isStandingsV2Enabled()` | `false` | Standings + tie-break (CC-07) |

Implementation: `src/features/competition-core/config/featureFlags.js`  
Env parsing: `src/features/competition-core/config/envReader.js`

---

## 2. Parsing rules

- `"true"`, `"1"`, `"yes"`, `"on"` → `true`
- Missing, empty, invalid strings → `false`
- **Never** read `import.meta.env` outside `envReader.js` / `featureFlags.js`

---

## 3. Dependencies

```text
RATING_V2 / DRAW_V2 / MATCHMAKING_V2 / STANDINGS_V2
    └── require VITE_COMPETITION_CORE_ENABLED = true
```

If core is off, all sub-flags evaluate to `false` even when set to `"true"`.

---

## 4. CC-01 behavior guarantee

Even when flags are `"true"`:

- `isEngineV2Available()` returns **`false`** (V2 not shipped)
- Adapter **`executionPath` remains `legacy`**
- No production route reads these flags yet

---

## 5. Rollback

1. Set all `VITE_COMPETITION_CORE_*` to `false` or remove from env
2. Redeploy / restart dev server
3. No database rollback required (no schema changes)

Instant rollback = flags off → legacy engines only (current production behavior).

---

## 6. Environments allowed to enable (future)

| Environment | CC-01 | Future pilot |
|-------------|-------|--------------|
| Local dev | Optional for integration tests | CC-12 shadow mode |
| Vercel Preview | **Not enabled** | CC-12 with owner GO |
| Production | **Forbidden** until CC-12 owner GO | Staged rollout |

**CC-01:** Do not add flags to production `.env` files.

---

## 7. Testing

`tests/competition-core-feature-flags.test.js` — defaults, invalid values, core dependency.

Inject env via second argument: `isDrawV2Enabled({ VITE_COMPETITION_CORE_ENABLED: "true", ... })`.
