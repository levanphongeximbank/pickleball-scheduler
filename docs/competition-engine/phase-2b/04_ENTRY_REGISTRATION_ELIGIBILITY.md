# 04 — Entry, Registration, and Eligibility

**Phase:** 2B.1

---

## Definitions

| Concept | Definition |
|---------|------------|
| **Participant** | Person/org with standing in a competition |
| **Entry** | Concrete slot in a division/category that draw/match engines consume |
| **Registration** | Workflow/process that creates and decides an Entry |
| **Eligibility** | Rule evaluation outcome for a subject (person, entry, roster add) |

Today Individual formats **collapse Registration into Entry fields**. Canonical design splits them for audit clarity while adapters can keep a 1:1 embedded mapping.

---

## Current Production behavior (verified)

### Individual / Internal / Official

- Model: `src/models/tournament/entry.js`
- Status: `ENTRY_STATUS` (`draft` … `withdrawn` + legacy `active`)
- Waitlist: `entry.waitlistPosition` on Entry
- Registration engine: `individual-tournament/engines/registrationEngine.js`
- Eligibility: `individual-tournament/engines/eligibilityEngine.js` (age, gender, skill, rating, club, invite, whitelist, max regs)
- Withdrawal: separate settings records keyed by `entryId`
- Matches reference `entryAId` / `entryBId`

### Daily Play

- No Entry
- Participation = presence in `checkedInPlayerIds`
- Eligibility ≈ available/checked-in for AI constraints (`RulePlayerSnapshot`)

### Team Tournament V6

- No Entry for athletes
- Team is the seed/draw unit
- Eligibility at roster-add time (`eligibilityEngine` TT)
- “Registration” of a team is team creation / setup snapshot — not `ENTRY_STATUS`

---

## Proposed relationships

```text
Competition
  └── CompetitionParticipant (person in competition)
        └── CompetitionRegistration (workflow; owns waitlist — OD-10)
              └── WAITLISTED → APPROVED → Entry created/activated
        └── CompetitionEntry (per division/category)     [Individual*]
              └── EligibilityDecision[] (append-only)
  └── CompetitionTeam
        └── CompetitionRoster  (locks at ROSTER_LOCKED — OD-04)
              └── CompetitionRosterMember → EligibilityDecision[]
```

\*Team format may omit Entry or use Entry only if a future “team entry” is introduced — **not required for TT V6 parity**.

---

## Entry ownership (Owner APPROVED)

| ID | Decision |
|----|----------|
| OD-02 | Multiple Entries per Participant allowed across different division/category/content. Default unique active: `(competitionId, divisionId, categoryId, entryRole)`. Format may define exceptions. |
| OD-03 | Entry always requires `competitionId`. May reference `divisionId` / `categoryId` (required or optional per Format config). No Entry without competition. |
| OD-10 | Waitlist belongs to `CompetitionRegistration`. Flow: submitted → WAITLISTED → APPROVED → Entry created/activated. Waitlisted registration is not an active Entry. |

---

## EligibilityDecision contract usage

Core owns:

- Decision shape
- Result enum: `eligible` | `ineligible` | `requires_review`
- Append-only history
- Link to `ruleSetId` / snapshot of inputs

Format owns:

- Which rules run
- Violation code vocabularies
- When to re-evaluate (roster add, registration submit, seed time)

Rating eligibility (`RATING_ELIGIBILITY_STATUS`) maps into `EligibilityDecision.result` via adapter — do not fork a second Core status system.

---

## Waitlist (OD-10 OWNER APPROVED)

| Today | Canonical |
|-------|-----------|
| `status=waitlisted` + `waitlistPosition` on Entry | Same fields on `CompetitionRegistration`; Entry created/activated only after APPROVED |
| Promotion = status → approved + clear position | Registration transition; Format max-capacity policy |

Legacy adapters may mirror waitlist fields onto Entry for Production parity until cutover.

---

## Proxy registration

`registeredByPlatformUserId` on Registration (optional) when someone registers another person. Competitor identity remains `ParticipantReference` of the athlete, not the registrar.
