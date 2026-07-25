# COACHING-02 — RLS & Authorization Design

## Verified helpers only

- `auth.uid()`
- `public.user_venue_id()`
- `public.user_club_id()`
- `public.user_has_permission(text)`
- `public.is_super_admin()`

No invented `user_tenant_id()`. No `USING (true)` / `WITH CHECK (true)`.

## Scope gate

`coaching_02_scope_allows(tenant_id, club_id)` requires:

1. `auth.uid()` present  
2. non-null `user_venue_id()` and `user_club_id()`  
3. `tenant_id = user_venue_id()`  
4. `club_id = user_club_id()`  

Fail-closed when actor/scope missing or mismatched.

## Action gate

`coaching_02_has_action(action)` → `is_super_admin() OR user_has_permission(action)`.

## Policy map

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| programs | `records.read` | `program.create` | `program.update` | none |
| coach_references | `records.read` | `coach.assign` | `coach.assign` | none |
| relationships | `records.read` | `coach.assign` | `coach.assign` | none |
| enrollments | `records.read` | `player.enroll` | `player.enroll` | none |
| curricula | `records.read` | `curriculum.create` | `curriculum.create` | none |
| lessons | `records.read` | `lesson.create` | `lesson.create` | none |
| training_sessions | `records.read` | `session.schedule` | `session.schedule` | none |
| attendance_records | `records.read` | `attendance.record` | `attendance.correct` | none |
| attendance_corrections | `records.read` | `attendance.correct` | **none** | **none** |
| packages | `records.read` | `package.create` | `package.create` | none |
| entitlements | `records.read` | `entitlement.grant` | grant **or** consume | none |
| usage_events | `records.read` | `entitlement.consume` | **none** | **none** |
| evaluations | `records.read` | `evaluation.submit` | `evaluation.submit` (draft only) | none |

All tables: `ENABLE` + `FORCE ROW LEVEL SECURITY`.

## SECURITY DEFINER RPCs

- Fixed `search_path = public, pg_temp`
- Explicit scope + action checks
- `REVOKE ALL … FROM PUBLIC` / `anon`
- `GRANT EXECUTE` to `authenticated` + `service_role` only
