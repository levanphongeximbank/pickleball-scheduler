# COACHING-04 — Assignment Mapping

**Status:** Design + SQL helpers authored (`10_COACHING_04_ASSIGNMENT_HELPERS.sql`)  
**Verdict:** `COACHING_04_ASSIGNMENT_MODEL_PROVEN` for **coach** binding (not player self-scope)

---

## 1. Coach identity proof

| Layer | Binding | Evidence |
|-------|---------|----------|
| JWT actor | `auth.uid()` | Platform / Supabase Auth; used by COACHING-02 RPCs as sole `actor_id` |
| Typed principal on coach row | `coaching_coach_references.coach_principal_id` | COACHING-02 table; Identity principal id stored as text |
| COACHING-04 AUTHORS binding | `coach_principal_id = auth.uid()::text` | Active refs in JWT tenant/club only |
| Tenant / club | `tenant_id = user_venue_id()`, `club_id = user_club_id()` | Same Sprint-2 identity proof as COACHING-02 (`05_TENANT_VENUE_SCOPE_RESOLUTION.md`) |

**Not** coach SoT:

- Phase 28 `coaching_coaches` (prototype names)
- Legacy LS `coaches[]` in `pickleball-coaching-v1`
- Club membership alone without an active `coaching_coach_references` row

Inactive coach references (`status = inactive`) do not resolve via helpers → deny.

---

## 2. Assignment tables

### `coaching_coach_references`

| Column | Role |
|--------|------|
| `coach_reference_id` | Primary Coaching coach handle used on sessions / relationships / evaluations |
| `coach_principal_id` | Typed Identity principal (`auth.uid()::text` for JWT coaches) |
| `coach_membership_id` | Optional Club membership typed ref (not used for RLS equality this step) |
| `tenant_id` / `club_id` | Scope |
| `status` | `active` \| `inactive` |

Unique: `(tenant_id, club_id, coach_principal_id)` — at most one principal binding per club scope.

### `coaching_coach_player_relationships`

| Column | Role |
|--------|------|
| `relationship_id` | Assignment row id |
| `coach_reference_id` | Owning coach ref |
| `player_id` | Typed Player reference (Player Management SoT — deferred RI) |
| `program_id` | Optional program-scoped assignment |
| `status` | `active` \| `inactive` (**inactive = revoked**) |

Unique: `(tenant_id, club_id, coach_reference_id, player_id, program_id)`.

### Downstream rows that inherit assignment

| Table | Coach link | Player link |
|-------|------------|-------------|
| `coaching_training_sessions` | `coach_reference_id` | via enrollment / attendance |
| `coaching_enrollments` | optional `coach_reference_id` | `player_id` |
| `coaching_attendance_records` | via session ownership | `player_id` |
| `coaching_evaluations` | `coach_reference_id` | `player_id` |
| `coaching_package_entitlements` | via assignment to `player_id` | `player_id` |
| `coaching_package_usage_events` | via assignment to `player_id` | `player_id` |
| `coaching_attendance_corrections` | via attendance → session/player | indirect |

---

## 3. Lifecycle

```
admin creates coach_reference (active)
        │
        ▼
admin creates relationship (active) ──► COACH can act under assigned.* perms
        │
        ├── status → inactive ──► DENY IMMEDIATELY (reads + mutations)
        │
        └── coach_reference status → inactive ──► helpers return NULL / false → DENY
```

Rules:

1. **Grant path** is admin-owned (`coaching.coach.assign`) — COACH cannot self-assign.
2. **Revoke** = set relationship `status = inactive` (preferred) or deactivate coach reference.
3. Revocation must not require waiting for JWT expiry; next statement fails helpers.
4. Historical rows remain in DB; access is gated by **current** active assignment, not by row authorship alone (except session ownership still requires active own `coach_reference_id`).

---

## 4. How helpers resolve `coach_reference_id`

Implemented in `10_COACHING_04_ASSIGNMENT_HELPERS.sql` (all SECURITY DEFINER, fail-closed):

| Helper | Resolution |
|--------|------------|
| `coaching_04_actor_uid()` | `auth.uid()::text` or NULL |
| `coaching_04_active_coach_reference_id()` | Single active ref where `coach_principal_id = auth.uid()::text` AND `tenant_id = user_venue_id()` AND `club_id = user_club_id()`; else NULL |
| `coaching_04_coach_assigned_to_player(player, program?)` | Active relationship for resolved coach ref + player; program filter when provided |
| `coaching_04_coach_owns_session(session_id)` | Session `coach_reference_id` equals active coach ref in scope |
| `coaching_04_coach_can_access_enrollment(enrollment_id)` | Enrollment in scope and player assigned (program-aware) |
| `coaching_04_coach_can_access_program(program_id)` | Active relationship for program (or null-program assignment covering player enrollments / sessions) |
| `coaching_04_has_assigned_action(action)` | Authenticated + `coaching_02_has_action(action)` |

**Intentionally absent:** any PLAYER principal → `player_id` helper (see `02_*`).

---

## 5. Negative cases (must deny)

| Case | Expected |
|------|----------|
| No JWT (`auth.uid()` null) | Deny |
| JWT without venue/club binding | Deny |
| Principal with no coach_reference in tenant/club | Deny |
| Coach reference `inactive` | Deny |
| Relationship `inactive` (revoked) | Deny |
| Active assignment in **other** club/tenant | Deny (scope mismatch) |
| Coach A assigned to player P; Coach B tries attendance/eval on P | Deny |
| Coach schedules session with **another** coach's `coach_reference_id` | Deny (WITH CHECK) |
| Coach holds only `coaching.records.read` (should not be granted) | Would be club-wide — **must not grant** |
| Cross-player entitlement consume | Deny in RPC |
| Anon / PUBLIC | No execute / no policies |

---

## 6. Relation to COACHING-02 / COACHING-03

- COACHING-02 RLS = admin permission + tenant/club only → granting COACH those permissions would be club-wide (documented in COACHING-03 matrix).
- COACHING-04 fixes that for COACH via **assignment-scoped** permissions and additive policies / RPCs.
- Admin paths remain on COACHING-02 policies; this pack does not DROP them.
