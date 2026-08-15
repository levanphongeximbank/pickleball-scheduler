# 01 — Authority matrix

External domains own source authority. Adapter contracts translate. Competition Core owns competition decisions.

| Ordinal | Contract | Authority owner | Adapter owns | Adapter must not own | Runtime |
| --- | --- | --- | --- | --- | --- |
| 01 | Identity & Access | `src/features/identity` | actor/role/permission **evidence** | credentials, sessions, passwords, grants, second RBAC | BOUND |
| 02 | Tenant & Organization | `src/features/tenant` | tenant id validation; distinct scope ids | tenant/org lifecycle; collapsing tenant/org/club/venue | PARTIAL (org NOT_CONFIGURED) |
| 03 | Participant | `src/features/player` | canonical player resolve + snapshot | player master mutation; display-name identity | BOUND |
| 04 | Club / Team / Membership | `src/features/club` | membership/affiliation evidence | seed/draw/matchup/standings/champion/eligibility final | PARTIAL (team roster NOT_CONFIGURED) |
| 05 | Rating | player-rating / Pick-VN | rating **snapshot** | seeding, pairing, eligibility final, draw | PARTIAL |
| 06 | Ranking | `src/features/vpr-ranking` | ranking snapshot when injected | ranking engine; mutating locked draw | NOT_CONFIGURED |
| 07 | Court | court-resource via Court contract | (external workstream) | this workstream must not modify | MERGED PR #432 |
| 08 | Referee | referee contract v1 | (external workstream) | this workstream must not modify | MERGED PR #431 |
| 09 | Finance & Payment | `src/features/finance` | payment evidence when injected | ledger, processor, invented refunds | NOT_CONFIGURED |
| 10 | Notification | `src/features/notifications` | outbound MATCH_SCHEDULED event | competition lifecycle; result mutation | PARTIAL |
| 11 | File & Media | none canonical | document/media **references** only | storage provider; general CMS | NOT_CONFIGURED |
| 12 | Streaming & Scoreboard | tournament-broadcast / referee UI | projection/metadata when configured | canonical scoring writes | NOT_CONFIGURED |
| 13 | Federation | ecosystem-integrations | external evidence when configured | invented federation data; final eligibility | NOT_CONFIGURED |
| 14 | CRM & Sponsor | `src/features/crm` | sponsor/package **references** | eligibility; sensitive CRM dump | NOT_CONFIGURED |
| 15 | Analytics & Reporting | intelligence/reporting analytics | outbound facts; non-authoritative reports | feeding derived numbers back as result truth | NOT_CONFIGURED |
| 16 | Audit | identity audit + CORE-20 | append/query when sink injected | approving ops; replacing domain persistence; dropping required audits | NOT_CONFIGURED |

## ID distinction (mandatory)

`tenantId` ≠ `organizationId` ≠ `clubId` ≠ `venueId`.

Never infer tenant from display names. Never use email/phone/display name as canonical identity.
