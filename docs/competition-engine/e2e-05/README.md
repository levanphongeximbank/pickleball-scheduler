# E2E-05 — Public Competition Experience MVP

**Phase:** E2E-05  
**Format:** INDIVIDUAL TOURNAMENT — POOL + KNOCKOUT  
**Status:** Implemented (capability-local; `wiredToProductionRuntime: false`)

## Purpose

Production-oriented **public read-model** for published competition experience:

discovery/detail → overview → participants → schedule → courts → pools → standings → qualification → bracket → Match Center → final results → archive.

Public Experience **only** reads canonical published projections. It does **not** call Organizer commands and does **not** infer unpublished data.

## Ownership

See [00_FILE_OWNERSHIP.md](./00_FILE_OWNERSHIP.md).

## Docs index

| Doc | Content |
|-----|---------|
| [00_FILE_OWNERSHIP.md](./00_FILE_OWNERSHIP.md) | Path ownership lock |
| [01_E2E_05_IMPLEMENTATION_REPORT.md](./01_E2E_05_IMPLEMENTATION_REPORT.md) | Full A–V report |
| [02_PUBLIC_PROJECTION_CONTRACT.md](./02_PUBLIC_PROJECTION_CONTRACT.md) | Facade + projection contract |
| [03_PUBLICATION_PRIVACY_MATRIX.md](./03_PUBLICATION_PRIVACY_MATRIX.md) | Publication/privacy gates |
| [04_LEGACY_REUSE_MAP.md](./04_LEGACY_REUSE_MAP.md) | Legacy public UI classification |
| [05_MATCH_CENTER_CONTRACT.md](./05_MATCH_CENTER_CONTRACT.md) | Match Center MVP |
| [06_BLOCKER_RESOLUTION.md](./06_BLOCKER_RESOLUTION.md) | BG-09 and related blockers |
| [07_TEST_EVIDENCE.md](./07_TEST_EVIDENCE.md) | Targeted + regression evidence |
| [08_E2E_06_READINESS.md](./08_E2E_06_READINESS.md) | Next-wave readiness |

## Primary API

```js
import {
  createPublicCompetitionExperienceFacade,
  buildPublicCompetitionExperienceSections,
} from "../src/features/competition-engine/index.js";

const facade = createPublicCompetitionExperienceFacade();
await facade.putPublishedCompetitionSnapshot({ tenantId, competitionId, snapshot });
const experience = await facade.getPublicCompetitionExperience({ tenantId, competitionId });
```

## Non-goals

Player check-in, referee score entry, Organizer commands, realtime backend, SQL, deploy, SEO overhaul, parallel engines.
