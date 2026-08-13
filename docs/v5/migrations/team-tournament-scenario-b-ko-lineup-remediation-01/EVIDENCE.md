# Evidence — Scenario B consolidated remediation

## Fixture (read-only)

`e3f37ef7-befe-4421-b694-8af57ba92a5d` — groupCount=2, qualifiersPerGroup=2, group Traditional 11/winBy2, changeEndsAt null (UI missing).

## Roots

| ID | Root |
|----|------|
| B1 | Setup UI missing `Đổi sân tại`; `stageScoringToFormat` omitted `sideSwitchAt`; Traditional hints skipped đổi sân |
| B2 | Captain tasks ignored `getLineup(matchupId)`; substitution gate blocked by historical published lineups; SQL delete-all CASCADE wiped group lineups |
| B3 | Cloud `matchups.replace` UNKNOWN_TEAM on empty Final placeholders; client KO math OK (2×2→semifinal) |
| B4 | rulesVersion sticky write-gate on KO generate without prepare; Staging MISSING_OBJECTS from unset env flag overwrite of TT-5 evidence |

## This turn

- Code remediation shipped on PR #418
- SQL package authored, **not applied** (`STAGING_NEW_MUTATIONS=0`)
