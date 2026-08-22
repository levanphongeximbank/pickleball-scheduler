# Mode Adapter B — Consumption Contract (document only)

**ADAPTER_B_IMPLEMENTED=NO**

## Flow

```
Official | Internal | Team | Daily
        ↓
Mode Adapter B (translate / constrain / compose only)
        ↓
Canonical Rules Adapter A  (competition.rules.policy.gateway.v1)
        ↓
Shared policy services + CORE-01 composition
        ↓
CORE-13 / CORE-15 / CORE-16 / CORE-17 / CORE-18 / CORE-12 (assignment) / 2.2_COURT_OPERATIONS (physicalCourtId SSOT) / Schedule
```

## Adapter B may

- Map mode settings blobs → canonical Competition Rules Profile
- Supply tenantId / competitionId / lifecycle milestone evidence
- Request stage-specific effective rules
- Surface capability truth to mode UI (read-only)
- Refuse mode configs that Adapter A rejects (fail closed)

## Adapter B must not

- Redefine shared scoring / qualification / tie-break semantics
- Become scoring engine (CORE-16)
- Become standings engine (CORE-18)
- Assign referees (CORE-13)
- Become Court assignment authority (CORE-12) or physical court SSOT (2.2_COURT_OPERATIONS)
- Mutate match lifecycle (CORE-15)
- Accept official results (CORE-17)
- Persist a second rules SSOT in localStorage / UI state
- Register as Canonical Adapter Contract #17

## Expected call shapes

```js
import { competitionRulesPolicyGateway } from
  "src/features/competition-core/competition-rules/index.js";

const gateway = competitionRulesPolicyGateway;

gateway.resolveEffectiveCompetitionRules({
  profile: canonicalProfileFromModeSettings,
  stage: "SEMIFINAL",
  ruleSource: "TOURNAMENT",
});

gateway.deriveQualificationPlan({ profile });
gateway.deriveKnockoutAdmissionPlan({
  profile,
  competitionPopulationEntryIds: ["entry-a", "entry-b"],
  groupParticipantEntryIds: ["entry-a"],
});
gateway.resolveKnockoutAdmissionPolicy({ profile });
gateway.canMutateCompetitionRule({
  profile,
  ruleClass: "SCORING_FORMAT",
  lifecycleMilestone: "AFTER_MATCH_START",
});
gateway.canMutateKnockoutAdmissionPolicy({
  profile,
  mutationKind: "DIRECT_KNOCKOUT_ENTRY",
  lifecycleMilestone: "AFTER_GROUP_DRAW",
});
```

## Mode-specific extensions stay outside profile

| Mode | Extension examples |
|------|--------------------|
| Official | public registration, fee, public page, rating eligibility gates |
| Internal | membership eligibility, club-only participant source |
| Team | roster, submatches, Dreambreaker, lineup lock |
| Daily | casual/session-oriented defaults |

Those remain mode translators / mode domains — not shared profile fields unless
genuinely shared later with Owner approval.
