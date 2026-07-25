# COACHING-02 — Phase 28 Drift & Disposition

**Source audited:** `docs/v5/PHASE_28_COACHING.sql`  
**Verdict:** Phase 28 is a **prototype draft**. It is **not** the canonical apply source. File is retained for history; COACHING-02 package replaces it for durable design.

## Drift matrix

| Area | Phase 28 | COACHING-02 canonical | Disposition |
|------|----------|----------------------|------------|
| Table/model | `coaching_coaches/students/classes/schedule` by name | Typed aggregates: programs, coach_references, relationships, enrollments, curricula, lessons, sessions, attendance, corrections, packages, entitlements, usage_events, evaluations | **Replace** — do not carry forward prototype tables |
| Tenant/club scope | `tenant_id uuid references venues(id)` | `tenant_id text` + `club_id text` (domain strings); no FK to venues | **Replace** |
| Version | Missing | `version integer >= 1` on mutable aggregates | **Replace** |
| Lifecycle | Partial status checks | Full COACHING-01 status sets + constraints | **Replace** |
| Append-only history | None | Corrections + usage events + submitted evaluation immutability | **New** |
| Authorization | 4 coarse keys: `coaching.view/manage/attendance/evaluate` | 14 COACHING-01 actions | **Replace** — coarse keys must not be carried forward as canonical |
| RLS | Commented draft only | ENABLE + FORCE + fail-closed policies | **Replace** |
| External ownership duplication | Stores coach/student names, package price | Typed refs only; no Finance price | **Do not carry forward** |
| Transaction atomicity | None | Attendance correction + entitlement consume RPCs | **New** |
| Naming | `external_*_id` prototype | Canonical `program_id`, `attendance_id`, … | **Replace** |
| Rollback / verification | None | `90_*` + `99_*` | **New** |
| Attendance statuses | present/absent/late | + `excused` | **Replace** |

## Carry-forward rules

| Part | Allowed? |
|------|----------|
| Phase 28 table DDL | **No** — not canonical |
| Phase 28 coarse permissions | **No** — superseded by 14 actions |
| Phase 28 as conceptual “coaching needs cloud tables” reminder | Reference only |
| Phase 28 file itself | **Keep** — do not delete; do not treat as apply source |

## Explicit conclusion

`docs/v5/PHASE_28_COACHING.sql` is **not** a canonical apply source for Coaching durable persistence. All Staging/Production apply decisions must use `docs/coaching-training/coaching-02/` after Owner authorization (out of COACHING-02 scope).
