# COACHING-04 — Access Matrix (13 tables)

**Legend**

| Symbol | Meaning |
|--------|---------|
| Y | Allowed under named permission + scope/assignment/self |
| N | Not allowed for that actor class |
| RPC | Client DML denied; SECURITY DEFINER RPC only |
| — | No policy / no grant path |

**Actors**

- **Admin:** COACHING-02 admin actions via COACHING-02 policies (unchanged).
- **COACH assigned:** active coach ref + relationship + `coaching.assigned.*`.
- **PLAYER self:** PM-ID-01 `MAPPED` + `coaching.self.read` + own `player_id` only (SELECT). Mutations = **N**.

**Revoked behavior:** relationship/coach inactive → COACH deny. Mapping non-MAPPED → PLAYER deny.

---

## Matrix

### 1. `coaching_programs`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y (`records.read`) | Y (`assigned.read` + can_access_program) | Y (`self.read` + own enrollment program) |
| INSERT/UPDATE | Y | N | N |
| DELETE | N | N | N |

### 2. `coaching_coach_references`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (own principal row) | Y (refs linked to self relationship) |
| INSERT/UPDATE | Y (`coach.assign`) | N | N |
| DELETE | N | N | N |

### 3. `coaching_coach_player_relationships`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (owns coach_reference) | Y (own `player_id`) |
| INSERT/UPDATE | Y | N | N |
| DELETE | N | N | N |

### 4. `coaching_enrollments`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (assigned enrollment) | Y (own `player_id`) |
| INSERT/UPDATE | Y | N | N |
| DELETE | N | N | N |

### 5. `coaching_curricula`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (program access) | Y (via own enrollment program) |
| INSERT/UPDATE | Y | N | N |
| DELETE | N | N | N |

### 6. `coaching_lessons`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (parent curriculum) | Y (via own enrollment curriculum) |
| INSERT/UPDATE | Y | N | N |
| DELETE | N | N | N |

### 7. `coaching_training_sessions`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (owns session / assigned) | Y (own enrollment or own attendance) |
| INSERT/UPDATE | Y | Y (`assigned.session.schedule` + own ref) | N |
| DELETE | N | N | N |

### 8. `coaching_attendance_records`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (assigned player) | Y (own `player_id`) |
| INSERT | Y / RPC | Y / RPC | N |
| UPDATE/DELETE | N / RPC correction | N | N |

### 9. `coaching_attendance_corrections`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (assigned attendance) | Y (own attendance corrections) |
| INSERT | RPC | N | N |
| UPDATE/DELETE | N | N | N |

### 10. `coaching_packages`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (tied to assigned player) | Y (tied to own entitlement/enrollment) |
| INSERT/UPDATE | Y | N | N |
| DELETE | N | N | N |

### 11. `coaching_package_entitlements`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (assigned `player_id`) | Y (own `player_id`) |
| UPDATE | RPC consume | RPC assigned consume | N |
| DELETE | N | N | N |

### 12. `coaching_package_usage_events`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (assigned `player_id`) | Y (own `player_id`) |
| INSERT | RPC | RPC | N |
| UPDATE/DELETE | N | N | N |

### 13. `coaching_evaluations`

| Op | Admin | COACH assigned | PLAYER self |
|----|:-----:|:--------------:|:-----------:|
| SELECT | Y | Y (assigned `player_id`) | Y (own + `status = submitted`) |
| INSERT/UPDATE draft | Y | Y / RPC | N |
| DELETE | N | N | N |

---

## Permission quick map

| Permission | Actor | Enables |
|------------|-------|---------|
| `coaching.assigned.read` | COACH | SELECT assigned scope |
| `coaching.assigned.session.schedule` | COACH | Session INSERT/UPDATE |
| `coaching.assigned.attendance.record` | COACH | Attendance INSERT / RPC |
| `coaching.assigned.evaluation.submit` | COACH | Evaluation INSERT/UPDATE / RPC |
| `coaching.assigned.entitlement.consume` | COACH | Consume RPC only |
| `coaching.self.read` | PLAYER | SELECT own rows only |

**Not granted to COACH or PLAYER:** `coaching.records.read`.
