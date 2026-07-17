# 02 — Validation Model

Validators are pure functions under `participants/validators/`.

## Result shape

```js
{
  valid: boolean,
  errors: [{ code, path, message, severity, metadata? }],
  warnings: []
}
```

Business-invalid data returns `valid: false` — does not throw.  
Programmer misuse of helpers (e.g. bad alias link args) may throw `TypeError`.

## Validators

| Function | Purpose |
|----------|---------|
| `validateParticipantReference` | Kind + id |
| `validateCompetitionParticipant` | Identity + status |
| `validateCompetitionEntry` | Requires competitionId; optional context for division/category/role |
| `detectDuplicateActiveEntryScopes` | OD-02 uniqueness (policy override via `allowDuplicateScope`) |
| `validateCompetitionRegistration` | Status + OD-10 waitlist rules |
| `assertWaitlistDoesNotActivateEntry` | Waitlist ≠ active Entry |
| `validateEligibilityDecision` | Decision shape |
| `validateCompetitionTeam` | Team shape |
| `validateCompetitionRoster` / `validateRosterMember` | Roster + duplicates |
| `assertRosterNotDirectlyMutatedWhenLocked` | OD-04/05 |
| `validateCompetitionLineup` / `validateLineupRevision` | Lineup structure |
| `validateLineupRevisionSequence` | Monotonic revisions |
| `assertLineupRevisionImmutableWhenLocked` | OD-06 |
| `validateDivision` / `validateCategory` | Separate entities |
| `assertDivisionAndCategoryAreSeparate` | OD-07 |
| `validateParticipantSnapshot` | JSON-safe snapshot |

Inputs are not mutated.
