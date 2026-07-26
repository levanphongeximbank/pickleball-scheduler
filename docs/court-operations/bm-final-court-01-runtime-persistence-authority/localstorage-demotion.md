# localStorage demotion

## What changed

- localStorage is **not** canonical source of truth.
- `saveCourtEngineStore` / `saveActiveSessionId` require explicit local authority.
- Fire-and-forget cloud push after local save **removed**.
- Durable adapter never sets `usesLocalStorage` / never dual-writes.
- Legacy keys are retained for **read/migration** only; keys/data are **not deleted**.
- Claim local writes gated the same way.

## Explicit local enablement

```bash
VITE_COURT_RUNTIME_AUTHORITY=development_local
# or
VITE_COURT_RUNTIME_AUTHORITY=offline_local
```

Outside Production/Staging/Preview, `VITE_COURT_ENGINE_STORE=local` still maps to `development_local` for compatibility.

## Evidence

- Tests assert zero localStorage writes under durable authority.
- Durable write failure returns typed error without local success mask.
