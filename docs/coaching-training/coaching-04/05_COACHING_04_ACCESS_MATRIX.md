# COACHING-04 — Access Matrix (13 tables)

**Legend**

| Symbol | Meaning |
|--------|---------|
| Y | Allowed under named permission + scope/assignment |
| N | Not allowed for that actor class |
| blocked | PLAYER self-scope blocked (`COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED`) |
| RPC | Client DML denied; SECURITY DEFINER RPC only |
| — | No policy / no grant path |

**Actors**

- **Admin:** holders of COACHING-02 admin actions (`coaching.records.read`, mutate actions) via COACHING-02 policies (unchanged).
- **COACH assigned:** active coach ref + active relationship (where required) + `coaching.assigned.*` permissions via additive `coaching_04_*` policies / RPCs.
- **PLAYER self:** **blocked / N** this step — no policies, no grants.

**Revoked behavior:** relationship `inactive` or coach ref `inactive` → COACH helpers false/NULL → deny on next statement (no grace).

**Hidden / sensitive fields (all actors via API projection guidance):** prefer omit or redact `external_payment_reference`, internal `coach_membership_id` unless admin; never accept client-forged `actor_id` / `recorded_by_actor_id` on trusted paths (RPCs overwrite from `auth.uid()`).

---

## Matrix

### 1. `coaching_programs`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + can_access_program) | blocked / N |
| INSERT | Y (`program.create`) | N | N |
| UPDATE | Y (`program.update`) | N | N |
| DELETE | N (no client DELETE) | N | N |

Hidden: none required beyond normal.

### 2. `coaching_coach_references`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + **own** active/inactive? → **own row only** via principal match) | blocked / N |
| INSERT | Y (`coach.assign`) | N | N |
| UPDATE | Y (`coach.assign`) | N | N |
| DELETE | N | N | N |

COACH SELECT: own `coach_principal_id = auth.uid()::text` in scope (see policy).

### 3. `coaching_coach_player_relationships`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + owns `coach_reference_id`) | blocked / N |
| INSERT | Y (`coach.assign`) | N | N |
| UPDATE | Y (`coach.assign`) | N | N |
| DELETE | N | N | N |

Revoked rows remain SELECT-visible to owning coach for audit of inactive links; **authorization helpers for other tables require `active` only.**

### 4. `coaching_enrollments`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + can_access_enrollment) | blocked / N |
| INSERT | Y (`player.enroll`) | N | N |
| UPDATE | Y (`player.enroll`) | N | N |
| DELETE | N | N | N |

### 5. `coaching_curricula`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + program access / scoped curriculum) | blocked / N |
| INSERT | Y (`curriculum.create`) | N | N |
| UPDATE | Y (`curriculum.create`) | N | N |
| DELETE | N | N | N |

### 6. `coaching_lessons`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + parent curriculum accessible) | blocked / N |
| INSERT | Y (`lesson.create`) | N | N |
| UPDATE | Y (`lesson.create`) | N | N |
| DELETE | N | N | N |

### 7. `coaching_training_sessions`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + owns session **or** assigned enrollment/player on session) | blocked / N |
| INSERT | Y (`session.schedule`) | Y (`assigned.session.schedule` + `coach_reference_id` = own active ref) | N |
| UPDATE | Y (`session.schedule`) | Y (`assigned.session.schedule` + own active ref on USING/CHECK) | N |
| DELETE | N | N | N |

### 8. `coaching_attendance_records`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + assigned player + owned/accessible session) | blocked / N |
| INSERT | Y (`attendance.record`) | Y (`assigned.attendance.record` + assigned player + owns session) **or RPC** | N |
| UPDATE | — / RPC correction only | N (no direct UPDATE) | N |
| DELETE | N | N | N |

Preferred coach path: `coaching_04_record_assigned_attendance` RPC.

### 9. `coaching_attendance_corrections` (append-only)

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + correction’s attendance in assigned scope) | blocked / N |
| INSERT | RPC (`coaching_apply_attendance_correction`) | N (no assigned correct perm this pack) | N |
| UPDATE | N (immutable) | N | N |
| DELETE | N | N | N |

### 10. `coaching_packages`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + package tied to assigned player enrollment/entitlement) | blocked / N |
| INSERT | Y (`package.create`) | N | N |
| UPDATE | Y (`package.create`) | N | N |
| DELETE | N | N | N |

Hidden: `external_payment_reference` — admin-only projection recommended.

### 11. `coaching_package_entitlements`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + assigned `player_id`) | blocked / N |
| INSERT | Y (`entitlement.grant`) | N | N |
| UPDATE | RPC consume only | **RPC only** (`assigned.entitlement.consume`) | N |
| DELETE | N | N | N |

### 12. `coaching_package_usage_events` (append-only)

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + assigned `player_id`) | blocked / N |
| INSERT | RPC | RPC (`coaching_04_consume_assigned_entitlement`) | N |
| UPDATE | N | N | N |
| DELETE | N | N | N |

Hidden: `actor_id` is server-set; clients must not forge.

### 13. `coaching_evaluations`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + assigned `player_id`) | blocked / N |
| INSERT | Y (`evaluation.submit`) | Y (`assigned.evaluation.submit` + assigned player) **or RPC** | N |
| UPDATE | Y (`evaluation.submit` + draft only) | Y (`assigned.evaluation.submit` + draft + assigned) **or RPC** | N |
| DELETE | N | N | N |

Submitted rows immutable (COACHING-02 trigger); revisions = new rows.

---

## Permission quick map (COACH)

| Permission | Enables |
|------------|---------|
| `coaching.assigned.read` | SELECT policies above |
| `coaching.assigned.session.schedule` | Session INSERT/UPDATE (own ref) |
| `coaching.assigned.attendance.record` | Attendance INSERT (+ record RPC) |
| `coaching.assigned.evaluation.submit` | Evaluation INSERT/UPDATE draft (+ submit RPC) |
| `coaching.assigned.entitlement.consume` | Consume RPC only |

**Not granted to COACH:** `coaching.records.read` and other admin catalog actions.

---

## RPC-only summary

| Mutation | Admin RPC / path | COACH path |
|----------|------------------|------------|
| Attendance correction | `coaching_apply_attendance_correction` | Not in COACHING-04 |
| Entitlement consume | `coaching_consume_entitlement` | `coaching_04_consume_assigned_entitlement` |
| Assigned attendance record | direct INSERT (admin policy) | RPC preferred + scoped INSERT policy |
| Assigned evaluation | direct INSERT/UPDATE | RPC preferred + scoped policies |
