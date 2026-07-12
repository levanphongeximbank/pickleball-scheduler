# CC-05A — Constraint Model

**Phase:** CC-05A

## FORMATION_CONSTRAINT_KIND

| Kind | Legacy aliases |
|------|----------------|
| `must_partner` | prefer_partner |
| `must_not_partner` | avoid_partner |
| `avoid_repeat_partner` | — |
| `avoid_repeat_opponent` | — |
| `skill_gap` | level_diff |
| `gender` | — |
| `age` | — |
| `availability` | — |
| `check_in` | — |
| `rest_time` | — |
| `court_availability` | — |
| `manual_lock` | — |
| `organization` | — |
| `club` | avoid_same_club |
| `custom` | fallback |

Factory: `createFormationConstraint()`

Legacy mapper: `mapLegacyFormationConstraintKind()`

Severity: `hard` | `soft` (default soft)
