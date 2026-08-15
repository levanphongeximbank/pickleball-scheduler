# Conformance test spec

Harness: `runCompetitionRefereeAdapterConformance(adapter, options?)`

Reusable by Daily / Internal / Official / Team adapters.

## Required areas

CONTRACT_VERSION  
MATCH_CONTEXT  
PARTICIPANT_CONTEXT  
SCORING_RULES  
LIFECYCLE_POLICY  
CAPABILITIES  
PRESTART_POLICY  
RESULT_PROPAGATION  

## Fail-closed cases

UNKNOWN_MODE  
UNKNOWN_MATCH  
MALFORMED_CONTEXT  
MISSING_SCORING_RULES  
CROSS_TENANT_CONTEXT  
DIRECT_SCORE_AUTHORITY_FORBIDDEN  
DIRECT_RESULT_AUTHORITY_FORBIDDEN  
DIRECT_REFEREE_AUTHORITY_FORBIDDEN  

## Mode-adapter usage

```js
import { runCompetitionRefereeAdapterConformance } from "../src/features/competition-engine/index.js";

const report = runCompetitionRefereeAdapterConformance(teamAdapter, {
  validRequest: { tenantId, competitionId, matchId },
});
assert.equal(report.ok, true);
```

Registry: `createCompetitionRefereeAdapterRegistry({ adapters })` — immutable, reject unknown mode / bad version / malformed / duplicate mode.
