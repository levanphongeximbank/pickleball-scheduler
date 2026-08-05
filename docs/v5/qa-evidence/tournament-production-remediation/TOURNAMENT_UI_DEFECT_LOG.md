# Tournament UI Defect Log

**Date:** 2026-08-05  
**Environment:** Production (owner screenshots + live SELECT reconciliation)  
**Role:** SUPER_ADMIN  
**Production mutations:** 0  
**Status:** OPEN — ready for implementation

| ID | Sev | Route | Cloud record | Status | Screenshot |
|----|-----|-------|--------------|--------|------------|
| TP-UI-001 | HIGH | `/tournament/daily/tournament-1785921300822` | NO | OPEN_READY_FOR_IMPLEMENTATION | `image(379).png` |
| TP-UI-002 | HIGH | `/tournament/internal/tournament-1785921409840` | NO | OPEN_READY_FOR_IMPLEMENTATION | `image(380).png`, `image(384).png`* |
| TP-UI-003 | HIGH | `/tournament/official/tournament-1785921550968` | NO | OPEN_READY_FOR_IMPLEMENTATION | `image(381).png` |
| TP-UI-004 | HIGH | `/tournament/*` legacy family | N/A | OPEN_READY_FOR_IMPLEMENTATION | `image(382).png` |
| TP-UI-005 | MED | Daily/Internal/Official | N/A | OPEN_DEPENDENCY | `image(383).png` |

\* All six original Owner screenshots: `evidenceClassification=LOCAL_EVIDENCE_ONLY`, `commitEligibility=NO_PENDING_REDACTION`, `stageEligibility=NO`, `originalFileModified=NO`, `piiPresent=YES`. Not part of the Git commit package.

**Live note:** ACCC club `tenant_id=venue-prod-main` proven. Missing-tenant errors are wiring/localStorage, not missing Production club tenant.

## Root-cause classifications (evidence)

| ID | Root cause | Proven data source |
|----|------------|--------------------|
| TP-UI-001 | `LOCAL_BROWSER_ONLY_OBJECT` | Title: `getTournament` → `pickleball-club-data-v3::{clubId}`; players: club pairing pool |
| TP-UI-002 | `LOCAL_BROWSER_ONLY_OBJECT` | Title: localStorage blob; players: athlete pool (34 eligible); pairing omits tenantId |
| TP-UI-003 | `LOCAL_BROWSER_ONLY_OBJECT` | Title: localStorage blob; all-clubs pool blocked by `default-tenant` fallback |

Cloud durable records for all three Owner IDs: **ABSENT** (0/3). Same-browser refresh can preserve; other device cannot. Migration required.

Machine log: `TOURNAMENT_UI_DEFECT_LOG.json`
