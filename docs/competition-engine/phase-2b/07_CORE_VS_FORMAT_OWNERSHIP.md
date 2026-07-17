# 07 — Core vs Format Ownership (Participant Domain)

**Phase:** 2B.1  
**Rule:** Core must not import format modules. Format adapters call Core.

---

## Core may own

| Contract / concern | Notes |
|--------------------|-------|
| Identity / `ParticipantReference` | Discriminated refs |
| `CompetitionParticipant` | Competition-scoped person |
| `CompetitionEntry` structure + status | Not partner SMS policy |
| Registration status machine (generic) | Format supplies transitions policy config |
| `EligibilityDecision` result shape | Format supplies rules |
| Division / Category **references** | Not format taxonomies |
| `CompetitionTeam` / `CompetitionRoster` / `CompetitionRosterMember` structure | |
| `CompetitionLineup` structure + generic lock states | |
| Canonical validation result | Structure OK / membership ⊆ roster |
| Audit metadata contract | |
| Seed identity discriminant | entry \| team \| player |

---

## Format owns (must stay out of Core participant contracts)

### Team Tournament V6

| Policy | Location today (indicative) |
|--------|----------------------------|
| MLP gender composition | `teamRosterEngine` / MLP presets |
| Captain submission | Lineup portal / deadlines |
| Hidden lineup | Visibility RPC / `getVisibleLineup` |
| Dreambreaker | `dreambreakerEngine` |
| Team tie policy | `matchupTieEngine` |
| Forfeit policy | `forfeitWorkflowEngine` |
| Discipline genderRequirement | `normalizeDiscipline` |

### Daily Play

| Policy | Location |
|--------|----------|
| Rotation | Daily engines / AI |
| Queue priority | Daily settings / UX |
| Walk-in behavior | Check-in flows |
| Court-side “team” labeling | Match UI — not Team entity |

### Individual / Internal / Official

| Policy | Location |
|--------|----------|
| Singles/doubles partner policy | Registration + `PAIR_TYPE` |
| Partner invite token | Entry field + registration engine |
| Open / AI Balance registration | Official pairing engines |
| Max registrations / whitelist | `eligibilityEngine` (individual) |
| Entry fee | Format/ops (not Core participant) |

---

## Ownership matrix

| Capability | Core | Format adapter | Operations/UI |
|------------|------|----------------|---------------|
| Person identity refs | ✅ | maps aliases | display |
| Create entry | contract | validation rules | forms |
| Approve / waitlist | status API | capacity policy | director UI |
| Eligibility evaluate | decision DTO | rule set | show violations |
| Team create | contract | TT defaults | setup UI |
| Roster mutate | structure | MLP checks | captain/BTC |
| Lineup submit/lock | structure + version field | hidden/deadline/override | portals |
| Seed subject | SeedIdentity | map entry/team/player | TE UI |

---

## Dependency direction (target)

```text
team-tournament / individual-tournament / daily adapters
        ↓
competition-core/participants (contracts + pure validators)
        ↓
competition-ports (ParticipantRepository, TeamRepository, …)
        ↓
adapters (blob / supabase / shadow)
```

Forbidden: `competition-core` → `team-tournament` / `individual-tournament` / pages.

Grandfathered Phase 2A violations (13) remain until separate remediation — Phase 2B.1 adds **zero** new ones (docs only).

---

## Classification reminder (from Phase 1)

Participant normalization is listed as **GAP** in `07_CORE_VS_FORMAT_CLASSIFICATION.md`. Phase 2B.1 designs the gap fill; Phase 2B.2 implements shadow contracts only after Owner GO.
