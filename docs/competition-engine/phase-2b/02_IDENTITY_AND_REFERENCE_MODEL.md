# 02 — Identity and Reference Model

**Phase:** 2B.1  
**Status:** Design proposal — not implemented in Production

---

## Principle

```text
Do not assume all IDs are the same ID.
```

Platform user ≠ player profile ≠ club member ≠ competition participant ≠ entry ≠ team ≠ roster member ≠ lineup slot.

---

## Identity layers

| Layer | ID name (canonical proposal) | Current source | Purpose |
|-------|------------------------------|----------------|---------|
| Platform user | `platformUserId` | `auth.users` / `profiles.id` | Login, RBAC, portals |
| Player profile (blob) | `playerProfileId` | `players[].id` in club blob | Legacy athlete attributes in local/cloud blob |
| Athlete (cloud) | `athleteId` | `athletes.id` (Phase 42B) | Target stable person identity for TT / pairing |
| Club member | `clubMemberId` | blob `clubMember.id` or SQL `club_members.id` | Membership of a person in a club |
| Competition participant | `competitionParticipantId` | **Does not exist as first-class entity today** | Person-as-competitor within a competition aggregate |
| Competition entry | `competitionEntryId` | `entry.id` | Unit registered into division/category (individual formats) |
| Team | `competitionTeamId` | `team.id` / `external_team_id` | Team Tournament competing unit |
| Roster member | `rosterMemberId` | Implicit (team membership row / index) | Membership of participant on team roster |
| Lineup slot | `lineupSlotId` | Implicit (`selections[disciplineId][i]` or SQL lineup_entries PK) | Seat in a match lineup |
| Seed identity | `seedObjectId` / handle | `EngineParticipant.id` or seed `participantId` | Rankable unit for seeding (entry **or** team — discriminant required) |

---

## ParticipantReference (stable cross-link)

Canonical proposal: every competition-facing reference to a person carries a **discriminated reference**, never a bare opaque string without type.

```text
ParticipantReference {
  kind: "platform_user" | "player_profile" | "club_member" | "guest" | "external" | "athlete"
  id: string
  aliases?: string[]          // known equivalent IDs (hydration / later link)
  displayNameSnapshot?: string
  externalSystem?: string     // when kind = external
  externalKey?: string
}
```

**OD-01 OWNER APPROVED:** Guest allowed without full account/profile. Later link to official profile updates aliases only — **must not** change stored `competitionParticipantId` / primary person identity.

### Mapping people who may or may not have accounts

| Persona | `kind` primary | Optional links | Notes |
|---------|----------------|----------------|-------|
| Có tài khoản + athlete | `athlete` or `platform_user` | `playerProfileId`, `clubMemberId` | Preferred long-term |
| Có tài khoản, chưa athlete | `platform_user` | optional later athlete alias | OD-01 approved |
| Thành viên CLB | `club_member` or `player_profile` | `clubMemberId` | Current Daily/Individual default |
| Khách mời / guest | `guest` | May lack `platformUserId`; link later via aliases | OD-01 |
| VĐV hệ thống ngoài | `external` | `externalSystem` + `externalKey` | Import / federation |
| Đăng ký thay (proxy) | Same person ref as competitor | `registeredByPlatformUserId` on Registration | Actor ≠ participant |
| Một người nhiều division | One `competitionParticipantId` | Many `competitionEntryId` | OD-02, OD-03 APPROVED |

---

## CompetitionParticipant vs platform identity

```text
CompetitionParticipant
  id: competitionParticipantId          // scoped to competition
  competitionId: string
  person: ParticipantReference          // points outside competition
  status: CompetitionParticipantStatus
  createdAt, updatedAt
  audit: AuditMetadata
```

Rules:

1. `competitionParticipantId` is **never** equal by convention to `platformUserId`.
2. Same person in two competitions → two `CompetitionParticipant` rows (or equivalent), same `person` reference.
3. Same person in two divisions of one competition → one Participant, multiple Entries (OD-02 APPROVED).

---

## Seed identity (discriminant)

Today `EngineParticipant.id` and seed `participantId` are overloaded.

Proposal:

```text
SeedIdentity {
  subjectKind: "entry" | "team" | "player"   // Daily may use player
  subjectId: string
  competitionId: string
  divisionId?: string
  categoryId?: string
}
```

Core seed pipeline must require `subjectKind`. Format adapters map:

| Format | subjectKind | subjectId |
|--------|-------------|-----------|
| Individual / Internal / Official | `entry` | `entry.id` |
| Team Tournament | `team` | `team.id` |
| Daily Play | `player` | `player.id` (session-scoped) |

---

## Alias / hydration strategy

Team Tournament already implements multi-key resolution (`teamRosterHydration`, athlete pool). Canonical rule:

1. Persist **one primary** `ParticipantReference.kind` + `id` on roster/entry members.
2. Keep `aliases[]` for read-time resolution only — do not invent a second SSOT.
3. Adapters own alias graphs; Core contracts accept resolved `ParticipantReference`.

---

## IDs that must not collide in Core contracts

| Forbidden assumption | Why |
|---------------------|-----|
| `entry.id === player.id` | False for doubles; false when synthetic `entry-${player.id}` |
| `team.id === club.id` | Team is competition unit |
| `captainPlayerId === platformUserId` | Captain is athlete/player id |
| `participantId` without kind | TE/seed ambiguity |
| Waitlist position without entry | Waitlist is entry-scoped today (OD-10) |

---

## Persistence independence

Identity contracts must not embed:

- React component state
- Supabase row shapes as Core types
- Page-local form DTOs

Persistence adapters map:

```text
Blob players[]  → ParticipantReference(kind=player_profile)
athletes row    → ParticipantReference(kind=athlete)
profiles row    → platformUserId link only
entry blob      → CompetitionEntry
team blob/SQL   → CompetitionTeam + Roster
```
