# COMMS-00 — Communication Foundation Architecture & Boundary Audit

**Product:** PICK_VN / Pickleball Scheduler Pro
**Capability:** Platform Core → Communication Foundation
**Phase:** COMMS-00 — Architecture & Boundary Audit (docs-only)
**Status:** Official (audit freeze)
**Branch:** `docs/communication-foundation-comms-00-audit`
**Audit start HEAD:** `32473bfdfd7818f7ea69ab2b6b0b1072715c5b81`
**Docs baseline HEAD (ff `origin/main` before commit):** `c37588d78d8db319345a848768472b0826bd63e6`
**Date:** 2026-07-24
**Mode:** Read-only repository audit + architecture documentation. No runtime, SQL, UI, or cross-module code changes.

---

## 1. Overview

Communication Foundation is the **canonical owner** of conversational messaging inside PICK_VN:

- 1–1 direct conversations
- Club conversation rooms
- PICK_VN community conversations
- Future optional contexts (tournament ops, coaching, system announcements) as **conversation types / context refs**, not ownership of those domains

The corresponding end-user experience belongs later under **Experience Channels → Messaging & Community Experience**. COMMS-00 freezes architecture and boundaries only.

### Audit verdict (existing capability)

| Domain | Verdict |
|--------|---------|
| User / club / community chat (conversations, DMs, rooms, reactions, receipts) | **NONE** — greenfield |
| CRM “messages” / templates / campaigns | **EXISTS (adjacent)** — outreach compatibility shell, not chat |
| Notification inbox / delivery | **EXISTS (dependency)** — must emit, must not re-own |
| Competition / referee / team-tournament realtime | **EXISTS (pattern only)** — must not reuse as chat bus |
| Chat moderation / user block / message report product | **NONE** — greenfield under Communication |

**No hard ownership conflict** with Platform Core Integration & Adoption, Club Management, Player Management, Notification, or Competition Engine was found for a docs-only Communication Foundation package.

---

## 2. Problem statement and goals

### Problem

PICK_VN is building multiple workstreams in parallel. Conversational messaging is a new Platform Core capability. Without a boundary freeze:

1. Chat terminology collides with CRM `messages`, Notification `inbox`, and Supabase Realtime `channel`.
2. Membership, identity, and delivery could be re-implemented inside a messaging module.
3. File ownership would collide with Platform Core, Club, Player, Notification, and Competition worktrees.

### Goals (COMMS-00)

1. Prove whether chat/messaging/realtime-for-chat already exists (result: **does not**).
2. Map existing contracts Communication must consume.
3. Freeze canonical ownership, taxonomy, and integration boundaries.
4. Propose file ownership to avoid cross-workstream conflict.
5. Publish phased roadmap COMMS-00 … COMMS-07 and COMMS-01 readiness.

### Non-goals (COMMS-00)

- No production module, SQL, RLS, UI, realtime subscription, storage wiring, notification wiring, deploy, lockfile, or source changes outside this docs package.

---

## 3. Scope and non-scope

### In scope (Communication Foundation — eventual ownership)

| Concern | Notes |
|---------|--------|
| Conversation | Aggregate root for a messaging thread |
| ConversationType | Taxonomy discriminator (see §6) |
| ConversationParticipant | Membership **inside a conversation** (not club membership) |
| ConversationRole | Roles scoped to a conversation (e.g. member, moderator) |
| Message | Chat message body + metadata |
| Message lifecycle | Create, edit (policy), soft-delete / tombstone, visibility |
| Reply | Threaded reply reference within a conversation |
| Reaction | Lightweight emoji/reaction on a message |
| Read receipt / unread state | Per-participant read cursor / unread counts for chat |
| Pinned message | Conversation-scoped pin |
| User blocking | Block for messaging reachability (Communication policy) |
| Message reporting | Abuse report records for messages |
| Moderation action | Mute / remove message / restrict participant (Communication or future Trust module — see §9) |
| Conversation access policy | Who may join/read/write a conversation |
| Realtime delivery **abstraction** | Port for push-of-chat-events (not match-live channels) |
| Attachment **reference** abstraction | Opaque refs to stored objects; not Storage platform itself |

### Explicit non-scope (must consume via contract / adapter)

| Concern | Canonical owner |
|---------|-----------------|
| Account, authentication, session, JWT | Identity (`src/features/identity/`, `src/auth/`) |
| Player profile / demographics / directory | Player Management (`src/features/player/`) |
| Club entity, club membership edges, governance | Club Management (`src/features/club/`) |
| Competition participant / match / schedule | Competition Engine / competition-core |
| Notification delivery, inbox, worker, providers | Notification Foundation (`src/features/notifications/`) |
| Generic file storage buckets / RLS for Storage | Platform / Identity storage policy (avatars today) |
| Organization / tenant lifecycle | Platform Core + multi-tenant contracts |
| Global account security audit persistence | Identity `audit_logs` |
| Production deployment infrastructure | Ops / existing deploy docs |
| CRM outreach drafts, templates, campaigns, CRM consent SoT | CRM (`src/features/crm/`) |

### Terminology collisions (do not overload)

| Existing term | Current meaning | Communication must use |
|---------------|-----------------|------------------------|
| `message` / `/crm/messages` | CRM outreach drafts | Prefer `chat message` / entity `Message` under Communication namespace |
| `inbox` | `notification_inbox` | Prefer conversation list / unread chat state — never `notification_inbox` |
| `channel` | CRM interaction medium **or** notification delivery channel **or** Supabase Realtime channel name | Prefer `Conversation` / `ConversationType`; reserve “realtime channel” for transport |
| `chat` (CRM enum) | CRM interaction medium | Not a conversation room |
| Player `moderation_notes` | Admin verification internals | Not chat moderation |

---

## 4. Canonical ownership matrix

```text
Identity     = who can log in and what they may do (account / RBAC)
Player       = who the athlete is (person profile)
Club         = which club the person belongs to
Notification = how system alerts are delivered / inboxed
Competition  = how the person appears inside a competition
CRM          = lead / campaign / outreach / CRM consent
Communication = what conversations and chat messages exist
```

| Concern | Owner | Communication role |
|---------|-------|--------------------|
| Auth account / session / RBAC matrix | **Identity** | Reference `authUserId`; authorize via existing `can()` / decision ports |
| Athlete person / privacy / directory | **Player** | Display snapshot + `playerId` refs (non-authoritative) |
| Tenant / venue scope | **Platform + Identity profiles** | Stamp `tenantId` (and venue/club scope where required); isolate |
| Club membership / governance | **Club** | Resolve audience for `CLUB` conversations; never write membership |
| System notification delivery / inbox / worker | **Notification** | **Emit only** via public barrel (`emitDomainNotificationEvent`, adapters) |
| CRM leads / campaigns / CRM consent | **CRM** | Do not own; optional consent check only for CRM-originated outreach |
| Competition runtime / match realtime | **Competition / TT / Referee** | Optional context ids on conversations; never piggyback chat on match channels |
| Conversation / Message / chat unread / pins / replies / reactions | **Communication** | Source of truth |
| Messaging block / report / chat moderation actions | **Communication** (or future Trust & Safety — see §9) | Source of truth for chat policy |
| Message attachment **references** | **Communication** | Policy + refs; Storage bucket owned elsewhere |
| Account security audit | **Identity** | Call for security actions; do not replace |
| Domain event envelope **shape** | **Platform contracts** (`commonEventEnvelope`) | Create envelopes; do not redefine schema |
| Platform-wide retention / legal hold | **Platform governance** (pending) | Local Communication retention class until platform policy exists |

### Platform Core placement

```text
Platform Core
 └── Communication Foundation   ← this capability

Experience Channels (later UX)
 └── Messaging & Community Experience
```

Communication Foundation must **adopt** the Platform Core public integration surface (`src/core/platform` — Phase 1 contract re-exports + `PLATFORM_CAPABILITY_MANIFEST`, landed on `main` via PR #189) and must **not** edit `src/core/platform/**` or Competition Engine from Communication branches.

**Caution:** `src/core/platform/index.js` still exports legacy scaffold helpers (`createNotification`, `createAuditEvent`, simplified permission matrices). Those are **not** Notification Foundation or Identity audit SoT. Communication must use `src/features/notifications` and `src/features/identity` for those concerns.

---

## 5. Dependency matrix

| Dependency | Stability | Consume how | Blocker for COMMS-01? |
|------------|-----------|-------------|------------------------|
| Identity & authentication | **Stable** | `authUserId`, session presence, account status, `normalizeRole`, Identity public API | No |
| Platform Core contracts + integration surface | **Stable** | Prefer `src/core/platform` public surface (re-exports Phase 1 contracts + `PLATFORM_CAPABILITY_MANIFEST`); or `src/core/platform/contracts/` | No |
| Player profile facade | **Usable through adapter** | `src/features/player/` barrel; display-only snapshots | No |
| Tenant / organization scope | **Usable through adapter** | `createPlatformScope` / tenant access helpers; opaque tenant ids | No |
| Club membership & governance | **Usable through adapter** | Club public API / membership read models for audience | No |
| Roles & authorization | **Stable** (codes); **adapter** (decisions) | Identity permission codes + fail-closed decisions; do not fork matrix; do not treat Platform scaffold `getPermissionMatrix()` as Identity SoT | No |
| Notification Foundation | **Stable** (emit/inbox contracts); production live channels still gated | Emit via `src/features/notifications` only; never own inbox/worker; **ignore** Platform scaffold `createNotification()` helper (not Notification Foundation) | No for COMMS-01 domain freeze; condition for later delivery UX |
| Realtime (TT / referee / match-live / court-engine) | **Usable as pattern only** | Copy architectural patterns (flags, envelope, dedupe, poll fallback); **new** Communication realtime contract | No |
| File storage (avatars) | **Usable through adapter** for avatars; **pending** for general attachments | Avatar URLs from Identity/Player; attachment Storage contract deferred to COMMS-05 | No for COMMS-01 |
| Audit / event logging | **Stable** schemas; **adapter** per concern | Platform `commonEventEnvelope` + Identity audit for security; Communication-local message audit later; Platform scaffold `createAuditEvent()` is not Identity audit SoT | No |
| Moderation product | **Pending** | Greenfield in Communication (or Trust) — design in COMMS-01, implement later | No (design only) |
| Data governance / retention | **Pending** (platform) | Define Communication retention class locally; follow soft-delete patterns | No (document policy stub) |
| Competition Engine | **Stable boundary** | Context refs only | No — must not modify Competition |
| Platform Core Integration & Adoption | **Stable on `main`** (PR #189 integration surface) | Consume published surface only; Communication branches must not edit `src/core/platform/**` | No |
| CRM consent | **Usable through adapter** for CRM channels | Not required for U2U chat core | No |

**Legend**

- **Stable** — safe to depend for domain contracts
- **Usable through adapter** — depend on public API / read model; never write foreign SoT
- **Pending** — missing product/policy; Communication may design stubs, not claim foreign SoT
- **Blocked** — none identified for COMMS-01 docs/domain foundation

---

## 6. Conversation taxonomy

Repository has **no** prior chat taxonomy. The following is adopted as Communication canonical vocabulary (aligned with product intent; not CRM/Notification terms).

| ConversationType | Purpose | Audience resolution owner |
|------------------|---------|---------------------------|
| `DIRECT` | 1–1 personal conversation | Communication (participants = auth/player refs) |
| `CLUB` | Club room | Club membership read via adapter; Communication owns room + messages |
| `COMMUNITY` | PICK_VN community conversation | Platform / community policy + Communication access policy |
| `SYSTEM` | System-originated conversation / announcement thread | Communication content; triggers may emit Notification events |

**Deferred types (context refs, not separate owners):** tournament ops, coaching — may appear later as `ConversationType` extensions or `contextRef` on an existing type. They must not move Competition or Coaching SoT into Communication.

### Relationship to existing permission

Identity already defines `team_message.send` (`PERMISSIONS.TEAM_MESSAGE_SEND`) with team scope. That permission is a **future authorization hook** for team-scoped messaging. It does **not** imply an existing chat product. Communication must not invent a parallel permission catalog; extend Identity catalog when product needs new codes (separate Identity change, not silent fork).

---

## 7. Domain entity map (architecture level)

```text
Tenant / Scope
  └── Conversation
        ├── type: DIRECT | CLUB | COMMUNITY | SYSTEM
        ├── accessPolicy
        ├── participants[]  → ConversationParticipant (role, joinedAt, mutedUntil, …)
        ├── pins[]          → Message refs
        └── messages[]
              ├── Message (body, authorRef, createdAt, lifecycleState, …)
              ├── replyTo → Message?
              ├── reactions[]
              ├── attachmentRefs[]   → opaque Storage refs (not blobs)
              └── reports[]          → MessageReport

Per participant state:
  readCursor / unreadCount
  notification preference hints → emit to Notification (not local inbox SoT)

Cross-cutting:
  UserBlock (blocker → blocked subject) — messaging reachability
  ModerationAction (target message or participant)
```

### Identity references (non-authoritative)

| Field | Source |
|-------|--------|
| `authUserId` | Identity |
| `playerId` | Player Management (optional display / directory link) |
| `clubId` | Club (for `CLUB` conversations) |
| `tenantId` | Platform scope |
| `competitionContextRef` | Optional opaque ref — Competition owns the target |

Display names/avatars are **snapshots or live projections**, never a second profile SoT (same rule as CRM `displaySnapshot`).

---

## 8. Authorization boundary

### Principles

1. **Fail closed** when RBAC is enabled; follow Identity / Platform authorization shapes.
2. Communication evaluates **conversation access policy** after Identity authentication.
3. Club-scoped write/read for `CLUB` conversations requires **active club membership** (Club adapter) **and** conversation participation / policy.
4. Communication must **not** re-implement `can()` or fork `ROLE_PERMISSIONS`.

### Layers

| Layer | Owner | Example |
|-------|-------|---------|
| Authentication | Identity | Session required |
| Global / tenant RBAC | Identity + Platform scope | Role may send team messages (`team_message.send`) |
| Club membership gate | Club adapter | Must be active member to join default club room |
| Conversation policy | Communication | Invite-only DIRECT; COMMUNITY public vs restricted |
| Moderation override | Communication moderation role / Trust | Remove message, mute participant |

### Proposed permission stance (COMMS-01 design input — not implemented here)

- Reuse `team_message.send` where team-scoped messaging applies.
- Add Communication-namespaced permissions (e.g. `communication.message.send`, `communication.moderate`) **only** via Identity catalog change in a later phase — not in COMMS-00.

---

## 9. Privacy, blocking, reporting, and moderation boundary

| Concern | Owner | Notes |
|---------|-------|-------|
| Player privacy / directory visibility | **Player** | Communication must respect public/internal projectors when showing people |
| Messaging block list | **Communication** | Blocks reachability for DIRECT / invites; does not suspend accounts |
| Account suspension | **Identity** | Hard stop above Communication |
| Message report | **Communication** | Stores report + message ref |
| Chat moderation actions | **Communication** (interim) | Soft-delete message, mute in conversation, ban from conversation |
| Future Trust & Safety module | Optional later split | If introduced, Communication keeps message SoT; Trust owns queue/workflow — document handoff before split |
| CRM consent | **CRM** | Applies to CRM outreach channels, not U2U chat body storage |
| Player `moderation_notes` | **Player / Identity admin** | Not chat moderation |

**Hard rule:** Communication blocking ≠ Identity suspension ≠ Club removal. Each remains a separate action with a clear adapter call if cross-effects are required.

---

## 10. Realtime, notification, storage, and audit integration boundary

### Realtime

| Do | Do not |
|----|--------|
| Define a Communication-owned realtime port (subscribe to conversation/message events) | Reuse `match-live-*`, referee V5, or team-tournament realtime channels for chat |
| Reuse **patterns**: feature flags, connection state, envelope validation, dedupe, polling fallback | Treat competition realtime services as a shared bus |
| Prefer “event → invalidate/reload projection” until COMMS-05 | Apply untrusted payloads as authoritative state without RLS |

Existing references (pattern only):

- `src/features/team-tournament/realtime/`
- `src/features/referee-v5/realtime/`
- `src/domain/matchLiveSync.js`
- `src/features/court-engine/storage/courtEngineRealtime.js`

### Notification

| Do | Do not |
|----|--------|
| Emit via `src/features/notifications` public API (`emitDomainNotificationEvent`, domain adapters) | Create a second inbox or delivery worker |
| Use Notification for “new message while offline / push / badge” | Store chat history in `notification_inbox` |
| Register Communication event types in Notification catalogue when implementing | Bypass tenant/env isolation |

### Storage / attachments

| Do | Do not |
|----|--------|
| Store **attachment references** (bucket, path, contentType, size, checksum) on Message | Own `user-avatars` or redefine avatar SoT |
| Plan a scoped bucket/path contract in COMMS-05 | Allow unscoped arbitrary uploads without tenant/RLS contract |
| Resolve avatars via Identity/Player | Duplicate avatar binaries into chat tables |

### Audit / events

| Do | Do not |
|----|--------|
| Use `createCommonEventEnvelope` (Platform contracts) for domain events | Redefine envelope schema |
| Keep message/moderation audit as Communication-owned records (later persistence) | Replace Identity `audit_logs` |
| Call Identity audit only for account-security adjacent actions | Persist audit into Competition or CRM stores |

---

## 11. File ownership proposal

### Documentation (owned now)

| Path | Owner |
|------|-------|
| `docs/communication-foundation/**` | Communication Foundation |

### Future runtime (not created in COMMS-00)

| Path | Owner | Notes |
|------|-------|-------|
| `src/features/communication/**` | Communication Foundation | Barrel-only public API (same pattern as `player/`, `notifications/`, `club/`) |
| `tests/communication-*.test.js` (or colocated) | Communication Foundation | When COMMS-01+ starts |
| `docs/supabase-communication-*.sql` (future) | Communication Foundation | Not in COMMS-00 |

### Must not claim / must not modify for Communication workstreams

| Path / area | Owner |
|-------------|-------|
| `src/features/identity/**` | Identity |
| `src/features/player/**` | Player Management |
| `src/features/club/**` | Club Management |
| `src/features/notifications/**` | Notification Foundation |
| `src/features/crm/**` | CRM |
| `src/features/competition-core/**`, `src/features/team-tournament/**`, `src/features/referee-v5/**` | Competition / TT / Referee |
| `src/core/platform/**` | Platform Core (consume contracts; do not restructure in Communication branches) |
| `docs/player-management/**`, `docs/club-phase2/**`, `docs/NOTIFICATION-*`, `docs/crm/**`, `docs/competition-engine/**` | Respective modules — do not rewrite to fit Communication |

### Shared-file policy

Communication branches may **only** touch:

1. `docs/communication-foundation/**`
2. Later: `src/features/communication/**` and Communication-owned tests/SQL docs

Any Identity permission additions, Notification catalogue entries, or Club adapter hooks require **explicit cross-module change requests** outside Communication-only commits.

---

## 12. Phased roadmap

| Phase | Name | Intent |
|-------|------|--------|
| **COMMS-00** | Architecture & Boundary Audit | This package — freeze ownership, taxonomy, dependencies, readiness |
| **COMMS-01** | Messaging Domain Foundation | Domain contracts, entity types, errors, ports, module skeleton (no production persistence) |
| **COMMS-02** | Direct Messaging | `DIRECT` conversations, send/list/read cursors (dev/staging-safe) |
| **COMMS-03** | Club Communication | `CLUB` rooms gated by Club membership adapter |
| **COMMS-04** | Community Communication | `COMMUNITY` (+ `SYSTEM` announcement threads as needed) |
| **COMMS-05** | Persistence & Realtime | SQL/RLS, attachment ref contract, Communication realtime port |
| **COMMS-06** | Messaging Experience | Experience Channels UI (list, thread, mobile shell integration) |
| **COMMS-07** | Integration Certification | Cross-module gates, staging evidence, production hold criteria |

### Suggested COMMS-01 deliverables (preview only)

- `src/features/communication/` skeleton + `index.js` barrel
- Domain types: Conversation, Message, Participant, policies
- Ports: `ClubMembershipPort`, `IdentityActorPort`, `PlayerDisplayPort`, `NotificationEmitPort`, `RealtimePort` (noop/memory)
- Non-goals: no SQL apply, no production routes, no Competition edits

---

## 13. Integration gates and blockers

### Gates before COMMS-01 implementation starts

| Gate | Criteria |
|------|----------|
| G0 Docs freeze | COMMS-00 package merged or on approved branch; Owner accepts ownership matrix |
| G1 Scope isolation | Branch only touches Communication-owned paths |
| G2 Dependency adapters | Ports defined for Identity, Player, Club, Notification, Platform scope |
| G3 Terminology | No reuse of `notification_inbox` / CRM message IDs for chat SoT |
| G4 Non-conflict | No edits to Platform Core Adoption / Competition Engine / Club / Player / Notification runtime |

### Gates before production messaging (later phases)

| Gate | Criteria |
|------|----------|
| N1 Notification catalogue | Communication event types registered; emit-only path verified |
| N2 Realtime isolation | Communication channels distinct from match/TT/referee |
| N3 Attachment contract | Bucket path + RLS + size/MIME policy approved |
| N4 Moderation MVP | Report + remove/mute paths exist |
| N5 Retention stub | Communication retention class documented; aligns with platform policy when available |
| N6 Staging evidence | Tenant isolation + membership gate + block list QA |

### Blockers identified in COMMS-00

| Item | Severity | Impact |
|------|----------|--------|
| None for docs-only COMMS-00 | — | — |
| None that block COMMS-01 **domain foundation** | — | Conditions listed below |

### Conditions (not blockers)

1. General attachment Storage contract is **pending** → defer to COMMS-05.
2. Platform-wide retention policy is **pending** → use local retention class.
3. Notification **production** live providers remain gated → chat can still emit to inbox/in-app paths per Notification rules.
4. Platform Core integration surface is on `main`; Communication must consume it and must not edit `src/core/platform/**`.
5. `team_message.send` exists without product — treat as reusable permission hook, not evidence of chat.

---

## 14. COMMS-01 readiness verdict

### Verdict: **READY_WITH_CONDITIONS**

Communication Foundation may proceed to **COMMS-01 Messaging Domain Foundation** under these conditions:

1. **Docs/skeleton only** until COMMS-01 entry checklist is satisfied (no SQL apply, no production routes).
2. **Adapter-first** dependencies: Identity, Player, Club, Notification, Platform contracts — no foreign SoT writes.
3. **No shared-file claims** on Platform Core / Competition / Club / Player / Notification / CRM.
4. **Taxonomy locked** to `DIRECT` | `CLUB` | `COMMUNITY` | `SYSTEM` unless a later ADR amends this document.
5. **Moderation / attachments / retention** designed as stubs or ADRs inside COMMS-01; implemented in later phases.

### Evidence summary

| Check | Result |
|-------|--------|
| Chat domain implementation present? | No |
| Ownership conflict with peer foundations? | No (boundaries clear) |
| Dependency map complete? | Yes |
| Docs home convention clear? | Yes — `docs/communication-foundation/` |
| Safe to author docs-only package? | Yes |

---

## Appendix A — Existing capability audit evidence

### A.1 Chat / messaging product code

- **None** under `src/features/communication/`, chat, messaging, conversation modules.
- Player Management explicitly lists **Messaging / chat** as out of scope (`docs/player-management/phase-1i`, `phase-1j`).

### A.2 Adjacent CRM outreach

- `src/features/crm/services/crmMessageService.js` — localStorage mock send
- `src/features/crm/pages/CrmMessagesPage.jsx` — SMS/Zalo-style UI
- Routes `/crm/messages` — **not** Communication Foundation

### A.3 Notification

- `src/features/notifications/` — inbox SoT, emit API, worker
- Docs: `docs/NOTIFICATION-PHASE-*.md`, `docs/supabase-notification-*.sql`

### A.4 Realtime (non-chat)

- Team tournament / referee V5 / match-live / court-engine realtime only

### A.5 Identity / profile / club

- Identity: `src/features/identity/` (+ `ARCHITECTURE.md`)
- Player: `src/features/player/` + `docs/player-management/`
- Club: `src/features/club/` + `docs/club-phase2/`
- Platform Core integration surface: `src/core/platform/index.js` (contract re-exports + `PLATFORM_CAPABILITY_MANIFEST`); contracts live under `src/core/platform/contracts/`

---

## Appendix B — COMMS-00 completion checklist

- [x] Safety baseline verified (worktree, branch, fresh `origin/main`, clean tree)
- [x] Repository read-only audit completed
- [x] Ownership matrix frozen
- [x] Dependency matrix frozen
- [x] Conversation taxonomy frozen
- [x] Integration boundaries documented
- [x] File ownership proposal documented
- [x] Roadmap COMMS-00 … COMMS-07 documented
- [x] COMMS-01 readiness verdict recorded
- [x] Docs-only scope (no runtime / SQL / lockfile / foreign module edits)

---

## Appendix C — Document control

| Field | Value |
|-------|-------|
| Canonical doc | `docs/communication-foundation/comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md` |
| Package index | `docs/communication-foundation/README.md` |
| Supersedes | — (initial) |
| Next phase | COMMS-01 Messaging Domain Foundation |
