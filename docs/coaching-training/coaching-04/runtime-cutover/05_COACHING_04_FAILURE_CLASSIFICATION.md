# COACHING-04 — Runtime Cutover Failure Classification

| Verdict | Meaning |
|---------|---------|
| `COACHING_04_RUNTIME_CUTOVER_REFUSED_OWNER_GO_NOT_GRANTED` | Default refuse — package only |
| `COACHING_04_RUNTIME_CUTOVER_PRODUCTION_REFUSED` | Production target / env |
| `COACHING_04_RUNTIME_CUTOVER_PACKAGE_READY_AWAITING_OWNER_GO` | Local package ready, no activation |
| `COACHING_04_RUNTIME_CUTOVER_PR_OPEN_CI_GREEN_AWAITING_OWNER_GO` | PR open + CI green; still no GO |

## Hard stops

- Production Supabase ref `expuvcohlcjzvrrauvud`
- `COACHING_DURABLE_RUNTIME_DEFAULT=true` in this package phase
- `LOCALSTORAGE_RETIRED=true` without retirement GO
- Silent durable→legacy success
- Mapping-row creation / backfill from this package
- Mutation RPC during cutover prep

## Safety stamps (every evidence artifact)

```text
runtimeActivated=false
localStorageRetired=false
productionTouched=false
filesDeleted=0
CODEX_DELETE_ALLOWED=NO
silentFallbackAllowed=false
```
