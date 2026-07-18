# 03 — Entry and Registration Evidence

| Rule | Evidence |
|------|----------|
| competitionId required (OD-03) | Missing tournamentId → `MISSING_COMPETITION_ID` |
| Division ≠ Category (OD-07) | `divisionId` / `categoryId` separate; `assertDivisionAndCategoryAreSeparate` |
| Multiple Entry valid (OD-02) | Same person, different division → no duplicate |
| Duplicate Entry detected | Same scope ACTIVE entries → `detectDuplicateActiveEntryScopes` fails |
| Waitlist ≠ Active Entry (OD-10) | Waitlisted → Registration only; `assertWaitlistDoesNotActivateEntry` |
| Withdraw not Active | `withdrawn` → Entry status WITHDRAWN |
| Team Entry ≠ Individual Entry | Team `entryRole: team` vs singles |
| Daily session ≠ Tournament Registration | Daily session mapping `entry: null` |
| Internal/Official source metadata | Format extensions `formatKind` preserved |
