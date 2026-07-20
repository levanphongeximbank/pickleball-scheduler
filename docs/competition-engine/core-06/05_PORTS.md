# CORE-06 — Ports (Phase 1B Scope Freeze)

**Status:** Purpose-only contracts. No implementation in Phase 1B.  
**Existing stub:** Phase 3E `LineupPersistencePort` (in-memory / noop; persistence OFF by default) — documentation aligns; Phase 1B does not extend runtime.

---

## 1. Port catalog

| Port | Purpose |
|------|---------|
| **LineupPersistencePort** | Load / list / save lineup and revisions by id or identity key; support `expectedVersion` on writes |
| **LineupAuthorizationPort** | Decide whether an actor may draft, submit, lock, publish, override, void, or view opponent |
| **LineupPolicy** | Format-injected rules: slot composition, transition asserts, deadline evaluation, visibility policy hooks |
| **LineupVisibilityPort** | Resolve visible lineup projections for an actor (server SoT; never trust UI) |
| **LineupClockPort** | Provide authoritative “now” for deadline evaluation (server time) |
| **LineupRandomPort** | Deterministic fill of missing slots given seed + roster + discipline template |
| **RosterLookupPort** | Resolve roster membership / version from Core-05 without deep imports |
| **AuditPort** | Append-only action log (actor, action, from/to, reason, request id, versions) |
| **IdempotencyPort** | Record command key + payload hash; detect replays vs conflicts |

---

## 2. LineupPersistencePort

**Purpose:** Abstract storage for `CompetitionLineup` and `CompetitionLineupRevision`.

Expected capabilities (contract intent):

- `getById`
- `listByCompetition`
- `save` / `saveRevision`
- `findByIdentityKey`
- Optimistic concurrency via expected revision/version
- No Production adapter in early CORE-06 phases

**Non-goals:** Supabase client, TT RPC wrappers, dual-write, SQL schema design in Phase 1B.

---

## 3. LineupAuthorizationPort

**Purpose:** Fail-closed authorization for lifecycle actions and opponent visibility.

Capability intents:

- `canDraft` / `canSubmit` / `canLock` / `canPublish` / `canOverride` / `canVoid`
- `canViewOpponent` / `canViewOwn`
- Align with identity permission codes: `team.lineup.*`, `team_lineup.*`

Actor classes: Captain, Manager/BTC, Tournament Director, Referee (read), System.

---

## 4. LineupPolicy

**Purpose:** Inject Format rules without importing TT engines into Core domain.

Capability intents:

- `validateSlots` (composition, gender, counts, reuse — Format)
- `assertTransition` (role/deadline-aware supplements to Core matrix)
- `evaluateDeadline`
- Visibility policy helpers consumed by VisibilityPort

Default for tests: noop / permissive or deny per phase rules — implementation deferred.

---

## 5. LineupVisibilityPort

**Purpose:** Server-side projection matching TT `team_tournament_get_visible_lineups` semantics:

- Own team: selections visible when authorized
- Opponent: null / hidden until `PUBLISHED` (and not `requires_republish`)
- TD / elevated: may see more per policy
- Referee: published assigned matchups only

Returns `VisibilityGrant` decisions and/or redacted lineup DTOs.

---

## 6. LineupClockPort

**Purpose:** Inject server-now for lock deadline. Client countdown is UX-only (TT-2B pattern).

---

## 7. LineupRandomPort

**Purpose:** Deterministic missing-lineup fill.

**Freeze condition (Phase 1A):** Production-ready Core random must be **seeded/deterministic**. Current TT `lineupRandomEngine` uses `Math.random` — known gap; Core must not copy non-determinism into the port contract.

Inputs (intent): seed, roster members, discipline template, existing slots.  
Output: filled slots or `MissingLineupResolution`.

---

## 8. RosterLookupPort

**Purpose:** DI bridge to Core-05 roster membership / `rosterVersion` without deep `teams/**` imports.

Used for INV-03 (person ⊆ roster).

Optional companion: team lookup for captain/deputy refs (authz may use separately).

---

## 9. AuditPort

**Purpose:** Append-only evidence for draft/submit/lock/publish/override/void/randomize/expire.

Must carry enough for TT revision parity: before/after, actor, reason, version, request id, action type.

---

## 10. IdempotencyPort

**Purpose:** Command idempotency aligned with TT-1B command log:

- Same key + same payload → replay safe result
- Same key + different payload → conflict
- Required for any future write path

---

## 11. Dependency injection shape (documentary)

```text
createLineupService({
  persistence,      // LineupPersistencePort
  authorization,    // LineupAuthorizationPort
  policy,           // LineupPolicy
  visibility,       // LineupVisibilityPort
  clock,            // LineupClockPort
  random,           // LineupRandomPort
  rosterLookup,     // RosterLookupPort
  audit,            // AuditPort
  idempotency,      // IdempotencyPort
})
```

Phase 1B does **not** create this service. Phase 3E already DI-injects a subset on `LineupResolver` for map/validate only.

---

## 12. Implementation ban (Phase 1B)

- No new port code files required
- No Production adapters
- No SQL
- No feature flags
- Purpose documentation only
