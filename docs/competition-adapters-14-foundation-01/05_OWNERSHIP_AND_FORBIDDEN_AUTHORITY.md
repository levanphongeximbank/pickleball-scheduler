# 05 — Ownership and forbidden authority

Adapters may **supply evidence** or **accept events/commands**. They do not make Competition decisions.

Forbidden authority keys on every owned contract:

- `eligibilityDecisionEngine`
- `seedingEngine`
- `pairingEngine`
- `drawEngine`
- `scheduleEngine`
- `courtAssignmentEngine`
- `refereeAssignmentEngine`
- `scoringEngine`
- `standingsEngine`
- `qualificationEngine`
- `knockoutEngine`
- `championEngine`
- `competitionLifecycleEngine`

Shared forbidden methods include decide/run variants of the same engines plus `writeCanonicalScore`.

Domain-specific forbids (examples):

- Identity must not authenticate, mint sessions, store passwords, grant permissions, or infer identity by display name
- Tenant must not create tenants/organizations or infer tenant from names
- Participant must not mutate player master profiles
- Club/Team must not decide seed/draw/matchups/standings/champion
- Rating/Ranking must not mutate a locked draw
- Finance must not own the ledger or invent a processor
- Notification must not own lifecycle or mutate results
- Streaming must not write canonical scores
- Federation must not invent external data or make final eligibility
- Analytics must not write canonical results
- Audit must not approve business operations or drop required security audits

Competition Core remains the composer of eligibility, draw, schedule, score, standings, and champion.
