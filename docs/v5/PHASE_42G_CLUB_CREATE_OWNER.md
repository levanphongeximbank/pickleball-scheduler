# Phase 42G — Club create → owner (athlete)

**SQL:** [`PHASE_42G_CLUB_CREATE_OWNER.sql`](./PHASE_42G_CLUB_CREATE_OWNER.sql)

## Rules

1. Athlete (`PLAYER`) may create a club **if** they have permission `club.create`.
2. Non–Super-Admin creator becomes in one `club_create` transaction:
   - active `club_members` row
   - governance `club_owner`
   - governance `president` when `phase42_creator_gets_president()` = true (default)
3. Platform role on `profiles` is **never** changed (athlete stays athlete).
4. **Never** write `profiles.club_id` for membership.
5. All create steps run in a **single** `SECURITY DEFINER` RPC `club_create` (one DB transaction; any error → full rollback).
6. Checks: auth, tenant eligibility, `club.create`, plan limit, idempotency `request_id`, duplicate name/code.
7. Owner scope = **club only** (not platform admin / not tenant admin).
8. Super Admin creating a club does **not** auto-become member/owner/president.

## Constraint

Trigger `trg_phase42_gov_active_member`: active governance assignment must reference an **active** `club_members` row with the **same** `tenant_id` + `club_id`.

## QA checklist

| # | Case | Expected |
|---|------|----------|
| 1 | Athlete with `club.create` tạo CLB | `ok`; member active; owner = creator; president = creator (default) |
| 2 | Reload / login lại | Vẫn là owner (canonical từ cloud) |
| 3 | Trình duyệt / máy khác | Cùng `owner_user_id` / label |
| 4 | Retry cùng `request_id` | Idempotent; không tạo CLB thứ hai |
| 5 | Lỗi tạo member / gov | Rollback toàn bộ — không còn row `clubs` orphan |
| 6 | Athlete tạo CLB | `profiles.role` vẫn `PLAYER`; không thành Super Admin |
| 7 | Owner CLB A | Không quản trị được CLB B (gov scoped theo `club_id`) |
| 8 | Super Admin tạo CLB | Club tồn tại; SA **không** trong `club_members` / owner / president |
| 9 | `profiles.club_id` | Không bị ghi khi create |

## Apply order

1. Staging: apply `PHASE_42G_CLUB_CREATE_OWNER.sql`
2. Staging QA (table above)
3. Production: same SQL
4. Redeploy client if RBAC matrix / UI changed (`PLAYER` + `club.create`)
