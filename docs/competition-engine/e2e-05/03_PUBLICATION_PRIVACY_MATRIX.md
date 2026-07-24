# E2E-05 — Publication & Privacy Matrix

| Surface | Competition pub | Schedule pub | Participants visible | Results pub | Bracket pub | Final pub | Archive visible |
|---------|-----------------|--------------|----------------------|-------------|-------------|-----------|-----------------|
| Overview | required | — | — | — | — | — | — |
| Participants | required | — | required | — | — | — | — |
| Schedule / courts | required | required | — | — | — | — | — |
| Pools (groups) | required | — | — | — | — | — | — |
| Standings | required | — | — | required | — | — | — |
| Qualification | required | — | — | required | — | — | — |
| Bracket | required | — | — | — | required | champion needs final | — |
| Match Center | required | — | — | score/result fields | — | — | — |
| Final results | required | — | — | — | — | required | — |
| Archive | required | — | — | — | — | — | required |

## Must not

- Display draft / unpublished competition
- Display unpublished schedule
- Display private participant identity
- Leak audit / permission / operations blockers
- Display unaccepted scores when policy forbids
- Bypass CM / E2E-03 publication vocabulary
- Cross-tenant reads

## Score policy (Match Center)

| Condition | Public score |
|-----------|--------------|
| `resultsPublished=false` | `null` |
| `scoreAccepted=false` / `scorePublished=false` | `null` |
| accepted + published | allowlisted score object |
| `validatedResult` when results published | public-safe subset |

## Tenant scope

`tenantId` + `competitionId` required. Record tenant/competition mismatch → `E2E05_CROSS_TENANT_REJECTED`. Missing record → `E2E05_RECORD_NOT_FOUND`.
