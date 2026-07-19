# CORE-01 — Operation Model

**SSOT:** `src/features/competition-core/constraints/operations/`

## Canonical operations

| Operation |
|-----------|
| TEAM_FORMATION |
| PARTNER_PAIRING |
| GROUP_DRAW |
| SEEDING |
| LINEUP |
| MATCHUP |
| SCHEDULE |
| COURT_ASSIGNMENT |
| REFEREE_ASSIGNMENT |
| SCORING |
| STANDINGS |
| TIE_BREAK |
| ELIGIBILITY |
| REGISTRATION |
| ALL |

These names are frozen. Do **not** replace them with informal names as canonical values.

## Explicit aliases (backward compatibility only)

| Alias | Canonical |
|-------|-----------|
| PAIRING | PARTNER_PAIRING |
| MATCH_GENERATE | MATCHUP |
| TEAM_ROSTER | TEAM_FORMATION |
| DIVISION | GROUP_DRAW |

Aliases are resolved via `resolveCanonicalOperation` and covered by unit tests.

## Matching rules (`matchRuleOperation`)

- Requested `ALL` → matches every rule.
- Rule lists `ALL` → matches every requested operation.
- Missing / empty `operations` on a rule → **backward compatible**: matches all operations.
- Otherwise require exact canonical membership after alias resolution.
- Unsupported requested operation → fail closed at resolution entry.
