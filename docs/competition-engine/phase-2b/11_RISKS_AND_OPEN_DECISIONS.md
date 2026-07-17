# 11 — Risks and Owner Decisions

**Phase:** 2B.1  
**Revalidation:** 2026-07-17 against `origin/main` @ `45442d54` (Phase 2A merge `fd044362` + docs 14/15 present)

---

## Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Triple person SSOT (`players` / `athletes` / `profiles.player_id`) | High | `ParticipantReference` + hydration adapter; no premature DB merge |
| R2 | Overloaded terms (entry/team/participant) cause wrong Core APIs | High | Semantic glossary enforced in contracts |
| R3 | Designing Entry for TT where Team is unit | Medium | TT mapping omits Entry unless needed |
| R4 | Boundary drift vs Phase 2A | Low | **CLOSED** — docs 14/15 read on latest main; see Revalidation notes |
| R5 | Approved policy mistaken for Production cutover | High | Flags OFF; no runtime wiring in 2B.2 without explicit GO |
| R6 | Lineup versioning mismatch client vs SQL CHECK | Medium | OD-06 approved full chain; keep Format extended statuses out of Core enum |
| R7 | Pairing `playerIds.join("|")` entry ids vs `createEntryRecord` | High | Adapter normalizes; do not promote join-id as Core identity |
| R8 | Starting 2B.2 without Owner GO | High | Hard gate in `10_` — OD-01..10 approved; still requires explicit 2B.2 GO |

---

## Owner decisions (OD-01 … OD-10)

Status for all ten: **OWNER APPROVED** (2026-07-17).

No OD conflicts with Phase 2A boundaries or Production code that require reversing Owner choice. Notes under each OD record alignment / adapter impact only.

---

### OD-01 — Guest participant

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Allow participants without a full platform account or player profile. |
| Contract | `ParticipantReference` must support: platform user, player profile, club member, guest, external athlete. |
| Policy | Guest may later link to an official profile. **Linking must not change** the stored Competition Participant identity (`competitionParticipantId` / primary person identity already persisted). |
| Consequence for 2B.2 | Reference kinds + link/alias fields; no forced athlete-row create on guest entry. |
| Phase 2A / code | Aligns with `normalizePlayer` guest/visitor/external and participants capability APPROVE start 2B. No blocker. |

---

### OD-02 — Multiple Entry in same Competition

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | One Participant may have multiple Entries in the same Competition when Entries belong to different division, category, or content. |
| Default unique rule | Forbid multiple **active** Entries sharing the same `(competitionId, divisionId, categoryId, entryRole)`. |
| Format exception | Format may allow exceptions only via explicit policy. |
| Consequence for 2B.2 | Validator encodes default uniqueness; Format policy hook for exceptions. |
| Phase 2A / code | Matches Individual multi-event practice. No blocker. |

---

### OD-03 — Entry scope

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | `CompetitionEntry` **always** belongs to a Competition (`competitionId` required). |
| References | May reference `divisionId` and/or `categoryId`. Required vs optional is Format configuration. |
| Forbidden | Entry that belongs only to a Division with no `competitionId`. |
| Consequence for 2B.2 | Contract requires `competitionId`; division/category optional at type level, Format config marks required. |
| Phase 2A / code | Matches `tournamentId` + `eventId` today. No blocker. |

---

### OD-04 — Roster lock

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Roster locks via explicit lifecycle event `ROSTER_LOCKED`. |
| Timing | `ROSTER_LOCKED` **must** occur before Competition or Stage transitions to `IN_PROGRESS`. |
| Not SSOT | UI/screen lock is **not** the source of truth. |
| After lock | All edits go through substitution workflow. |
| Consequence for 2B.2 | Status/lifecycle enums + lock timestamp fields; Format owns when the event is emitted. |
| Phase 2A / code | Roster capability KEEP IN FORMAT — Core owns lock contract; Format owns emission. No blocker. |

---

### OD-05 — Substitution after Competition start

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Default: **NOT ALLOWED** after competition/stage start. |
| Format exception | Format may allow substitution via explicit policy, **required** fields: reason, requester, approver, replaced person, replacement person, effective time, eligibility validation, audit record. |
| Forbidden | Direct mutation of the locked roster document. |
| Consequence for 2B.2 | Substitution request DTO + append-only audit; default policy `false`. |
| Phase 2A / code | Aligns with Format-owned roster/lineup ops. No blocker. |

---

### OD-06 — Lineup versioning

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Full immutable revision chain on each submit/change. |
| Minimum contract fields | `lineupId`, `revision`, `previousRevisionId`, `submittedAt`, `submittedBy`, `lockedAt`, `status`, `slots`, `reason` |
| Why | Required for TT hidden lineup, captain submission, random fallback, dispute resolution. |
| Consequence for 2B.2 | Versioned lineup DTO; adapters map `previousLineupVersion` / SQL revisions. |
| Phase 2A / code | Lineup KEEP IN FORMAT; Core owns structure. Partial versioning already exists. No blocker. |

---

### OD-07 — Division and Category

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Keep **two separate entities**. |
| Division | Branch/zone of competition with its own standings, draw, schedule, or progression. |
| Category | Condition classification (age, gender, skill, content). |
| Relation | A Division may reference one or more Categories. |
| Forbidden | Merging both into one shared field/kind. |
| Consequence for 2B.2 | Distinct types + reference helpers; mapping from EVENT_TYPE / groups / TT discipline. |
| Phase 2A / code | No conflict with Core boundaries. No blocker. |

---

### OD-08 — Participant snapshot

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Competition stores a snapshot at registration or lock time. |
| Minimum snapshot | Display name; rating; gender/category attributes needed for eligibility; club/team affiliation when needed; source identity reference; snapshot timestamp. |
| Clarification | Snapshot does **not** replace the source profile. |
| Consequence for 2B.2 | Snapshot DTO on Participant/Entry/Registration; live profile remains external. |
| Phase 2A / code | Matches rating V5 preference for snapshot fields when present. No blocker. |

---

### OD-09 — Rating used for seed

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Seeding uses rating snapshot at `SEED_LOCKED`. |
| After lock | Live rating changes do **not** auto-change seed or draw. |
| Re-seed | Requires deliberate seed-pipeline action **before** draw lock. |
| Consequence for 2B.2 | `SEED_LOCKED` lifecycle marker + seed input reads snapshot only. |
| Phase 2A / code | Seeding capability still pending wire; contract aligns with snapshot preference. No blocker. |

---

### OD-10 — Waitlist ownership

| Field | Value |
|-------|-------|
| Status | **OWNER APPROVED** |
| Date | 2026-07-17 |
| Decision | Waitlist belongs to `CompetitionRegistration`. |
| Default flow | Registration submitted → `WAITLISTED` → `APPROVED` → Entry created or activated. |
| Clarification | Waitlisted registration is **not** an active competition entry. |
| Consequence for 2B.2 | Move waitlist fields off Entry contract (legacy adapter may mirror for parity). Registration status owns waitlist. |
| Phase 2A / code | Today waitlist lives on Entry — **adapter debt**, not Owner reversal. Registration capability still `_pending_` WRAP; Core contracts follow OD-10. No blocker. |

---

## Decision log

| OD | Decision | Date | Status | Notes |
|----|----------|------|--------|-------|
| OD-01 | Allow guest; link later without identity change | 2026-07-17 | OWNER APPROVED | Reference kinds include guest |
| OD-02 | Multi-entry OK; unique active tuple | 2026-07-17 | OWNER APPROVED | `(competition, division, category, entryRole)` |
| OD-03 | Entry always under Competition | 2026-07-17 | OWNER APPROVED | division/category optional by Format config |
| OD-04 | `ROSTER_LOCKED` before `IN_PROGRESS` | 2026-07-17 | OWNER APPROVED | Not UI lock |
| OD-05 | Default NOT ALLOWED; audited Format exception | 2026-07-17 | OWNER APPROVED | No direct roster mutate |
| OD-06 | Full lineup revision chain | 2026-07-17 | OWNER APPROVED | Minimum fields listed above |
| OD-07 | Separate Division + Category | 2026-07-17 | OWNER APPROVED | Division may ref many Categories |
| OD-08 | Snapshot at registration/lock | 2026-07-17 | OWNER APPROVED | Does not replace profile |
| OD-09 | Seed from `SEED_LOCKED` snapshot | 2026-07-17 | OWNER APPROVED | No auto-update from live rating |
| OD-10 | Waitlist on Registration | 2026-07-17 | OWNER APPROVED | Not active Entry |

---

## Revalidation notes (Phase 2A)

Read on latest main:

- `docs/competition-engine/14_OWNER_DECISION_MATRIX.md`
- `docs/competition-engine/15_PHASE_2A_ARCHITECTURE_BOUNDARIES.md`

| Topic | Finding |
|-------|---------|
| Public Core API | Sole entry `competition-core/index.js` — participant stubs must export via barrel |
| Dependency ownership | Core must not import format modules / pages / React / Supabase |
| Grandfathered violations | 13 baseline rows unchanged by 2B.1 docs |
| Participant ownership | Capability **participants** = APPROVE start 2B; teams/roster/lineup KEEP IN FORMAT (structure contracts in Core OK) |
| Persistence ports | APPROVE start 2B — interfaces only in 2B.2; no DB implementation |
| Phase 2B entry criteria | 2A PASS + Owner matrix present; flags OFF; no Production DB migration |

**No Owner decision reversed.** Only design deltas after revalidation: close R4, bind OD-01..10 to APPROVED text above, correct OD-10 waitlist ownership away from provisional Entry recommendation, introduce `ROSTER_LOCKED` / `SEED_LOCKED` as named lifecycle events.
