# CORE-13 — Constraint Model

## Hard constraints (never overridable by manual assignment)

- Tenant and tournament scope
- Referee active status
- Required certification / role qualification
- Required referee role
- Availability window coverage
- No overlapping assignments
- Conflict-of-interest prohibition
- Match-specific exclusion
- Maximum simultaneous assignments
- Mandatory referee count / roles

## Soft constraints (scored; override only when request explicitly permits soft override)

- Workload balancing
- Consecutive-match minimization
- Court travel minimization
- Preferred referee role
- Experience / division familiarity
- Language or accessibility preference tags
- Assignment continuity
- Fairness across the tournament

## Evaluation ownership

| Constraint class | CORE-13 evaluates? | Supplied via |
|------------------|--------------------|--------------|
| Hard eligibility / overlap / COI | Yes (Phase 1C+) | Directory, quals, availability, existing assignments, conflict policy, schedule |
| Soft preferences | Yes (Phase 1C+) | Policy + optional workload history |
| Schedule generation | No | MatchScheduleInputPort |
| Court allocation | No | Court refs on schedule rows only |
| Generic multi-resource conflict resolution | No | CORE-14 consumes referee conflict projections |

## Manual / soft override rule

- Hard constraints: **never** overridden.
- Soft preferences: overridden **only** when `allowSoftOverride === true` on the request/policy.
