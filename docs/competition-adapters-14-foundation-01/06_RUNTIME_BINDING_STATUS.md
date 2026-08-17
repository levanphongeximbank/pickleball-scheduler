# 06 — Runtime binding status

Honesty rule: if runtime is missing, `PRODUCTION_BINDING=NOT_CONFIGURED`. No fake success.

| Contract | productionBinding | Notes |
| --- | --- | --- |
| Identity & Access | BOUND | wraps `createIdentityEvidenceFromIdentityAdapter`; `resolveSubjectIdentity` is Identity-domain point lookup by canonical subjectId only |
| Tenant & Organization | PARTIAL | tenant context guards bound; organization directory NOT_CONFIGURED |
| Participant | BOUND | wraps `createPlayerParticipantLookupAdapter` |
| Club / Team / Membership | PARTIAL | membership bound; team roster/captain NOT_CONFIGURED |
| Rating | PARTIAL | wraps rating snapshot adapter only when `resolveRatings` is injected |
| Ranking | NOT_CONFIGURED | VPR exists as a product; no CE ranking adapter on default path |
| Finance & Payment | NOT_CONFIGURED | finance module exists; CE competition binding not configured |
| Notification & Communication | PARTIAL | MATCH_SCHEDULED only |
| File & Media | NOT_CONFIGURED | |
| Streaming & Scoreboard | NOT_CONFIGURED | |
| Federation & External Authority | NOT_CONFIGURED | |
| CRM & Sponsor | NOT_CONFIGURED | |
| Analytics & Reporting | NOT_CONFIGURED | |
| Audit | NOT_CONFIGURED | identity/CORE-20 exist separately; CE adapter sink not default-wired |

`createCompetitionRuntimePorts` is **unchanged**. Existing Daily Play / Internal / Official / Team behavior is not switched onto these contracts in this PR.

RUNTIME_PERSISTENCE_GAP: none implemented as SQL. File/media, federation, CRM durable leads, competition audit SQL, finance production activation remain future domain work — not this workstream.
