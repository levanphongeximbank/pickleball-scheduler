# Safety Invariants — Phase 3A.2

```text
Phase 3A.2 creates infrastructure only.
Shadow remains disabled.
No real executor dispatch exists.
Legacy remains Production primary.
```

| Invariant | Required value |
|-----------|----------------|
| Default `shadowAllowed` (runtime decision) | `false` |
| Default shadow eligibility | `false` |
| Default `canonicalInvocationAllowed` | `false` |
| Primary executor / plan primary | `LEGACY` |
| Result return source | `LEGACY` |
| Production behavior change | **NONE** |
| Database | **UNCHANGED** |
| Feature flags | **OFF** |
| Runtime cutover | **NOT PERFORMED** |
| Phase 3B | **NOT STARTED** |

## Architecture lock expectations

Shadow sources under `runtime-control` must not contain:

`process.env`, `Date.now(`, `Math.random(`, Supabase, pages/, components/, fetch, localStorage, sessionStorage.
