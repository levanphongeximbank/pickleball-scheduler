# PROD-OPS-30D-01 — Next-Scope Decision

**This does not activate any new scope.**  
Tokens: `KEEP_CONSTRAINED` | `READY_FOR_SEPARATE_PILOT_CERTIFICATION` | `NOT_READY` | `NOT_APPLICABLE`

| # | Scope | Classification | Rationale |
|---|-------|----------------|-----------|
| 1 | Public Portal | **KEEP_CONSTRAINED** | Live constrained web; continue Ops cadence; not whole-platform GA |
| 2 | Clubs | **KEEP_CONSTRAINED** | Public LIVE count stable; RLS contracts PASS; no expand claim |
| 3 | Courts | **KEEP_CONSTRAINED** | Public LIVE count stable |
| 4 | Experience Channels | **KEEP_CONSTRAINED** | Public catalog honesty retained; LIVE_EMPTY tournaments/rankings |
| 5 | PWA | **KEEP_CONSTRAINED** | Web PWA shell available; not store release |
| 6 | Authenticated tenant workflows | **NOT_READY** | Interactive Production login NOT_EXERCISED; needs separate safe-account pilot cert |
| 7 | Competition Engine | **NOT_READY** | Full Production rollout NOT_APPROVED |
| 8 | Business Modules | **NOT_READY** | Full Production rollout NOT_APPROVED |
| 9 | Intelligence & Analytics | **NOT_READY** | Full Production rollout NOT_APPROVED |
| 10 | Ecosystem | **NOT_READY** | Live activation NOT_APPROVED |
| 11 | iOS | **NOT_READY** | App Store release NOT_APPROVED |
| 12 | Android | **NOT_READY** | Play Store release NOT_APPROVED |

```text
READY_FOR_SEPARATE_PILOT_CERTIFICATION_COUNT=0
KEEP_CONSTRAINED_COUNT=5
NOT_READY_COUNT=7
WHOLE_PLATFORM_GA=NOT_APPROVED
```

## Marker

`PROD_OPS_30D_01_NEXT_SCOPE_DECISION_RECORDED`
