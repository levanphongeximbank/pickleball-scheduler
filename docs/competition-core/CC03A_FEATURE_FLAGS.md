# CC-03A — Feature Flags

**Phase:** CC-03A | **Date:** 2026-07-12

---

## 1. Flag

| Env key | Helper | Default |
|---------|--------|---------|
| `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED` | `isConstraintsV2Enabled(envSource)` | `false` |

---

## 2. Gating rules

Constraints V2 requires **both**:

1. `VITE_COMPETITION_CORE_ENABLED=true`
2. `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED=true`

Same master-gate pattern as Rating V2, Draw V2, etc. (CC-01).

```javascript
import { isConstraintsV2Enabled, COMPETITION_CORE_FLAG_KEYS } from "src/features/competition-core";

isConstraintsV2Enabled({
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
}); // → true
```

Sub-flag alone → `false`.

---

## 3. Runtime behavior when OFF (default)

| Function | Behavior |
|----------|----------|
| `evaluateCanonicalRules()` | `{ enabled: false, feasible: true, softScore: 0 }` |
| `preflightRuleSet()` | `{ ok: true, conflicts: [] }` |

**No legacy consumer changes** — CC-03A is library-only until CC-03B wiring.

---

## 4. Deployment status

| Environment | Flag state |
|-------------|------------|
| Local dev | OFF (default) |
| Preview | Not deployed (CC-03A) |
| Staging | OFF |
| Production | OFF |

---

## 5. Enabling for local QA

Add to `.env.local` (do not commit secrets):

```
VITE_COMPETITION_CORE_ENABLED=true
VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED=true
```

Run tests with inline env (see `CC03A_TEST_REPORT.md`).
