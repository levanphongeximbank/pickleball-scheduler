# Runtime write inventory (post-remediation)

| Path | Sink | When |
|------|------|------|
| Canonical writer `saveSession` / `replaceStore` | Durable adapter → Supabase tables | Authority = `durable` |
| Canonical writer | Memory adapter | Authority = `test_memory` (injection) |
| Canonical writer | localStorage adapter | Authority = `development_local` / `offline_local` (explicit) |
| Demoted `saveCourtEngineStore` | localStorage | Only after `assertLocalStorageWriteAllowed()` |
| Claim `saveCourtClaimRequests` | localStorage | Only under explicit local authority |
| Cloud push from `saveCourtEngineStore` | **Removed** | Dual-write forbidden |

Cluster inventory keys in `data/courtCluster.js` remain outside Court Operations runtime authority (not demoted in this workstream).
