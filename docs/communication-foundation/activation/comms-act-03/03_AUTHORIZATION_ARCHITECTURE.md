# COMMS-ACT-03 — Authorization Architecture

**Phase:** COMMS-ACT-03 — Communication Authorization & Client RLS Foundation  
**Status:** Authored locally · **NOT applied** to Staging/Production  
**Fresh main baseline:** `adbf16f4` (origin/main at workstream start)

## Answers (canonical)

| # | Question | Decision |
|---|----------|----------|
| 1 | Ai được đọc conversation? | **CLUB:** active Club member (`phase42_active_club_member_id`) — Client SELECT after Owner apply. **DIRECT/SYSTEM/COMMUNITY:** trusted backend only (deny-all client). |
| 2 | Ai được tạo conversation? | Trusted backend only (all types). |
| 3 | Ai được gửi message? | Trusted backend only (app authorization then service-role). |
| 4 | Ai được sửa/xóa nội dung? | Trusted backend only. Message identity columns (`sender_participant_id`, `conversation_id`, `position`) immutable via trigger. Conversation ownership columns immutable. |
| 5 | Ai quản trị participant / pin / moderation / report? | Trusted backend only after application authorization. Community moderator Client RLS blocked. |
| 6 | Tenant / Club / Community ownership source? | **Identity:** `auth.uid()` + `profiles`. **Tenant:** `venues.id` via `user_venue_id()`. **Club:** `public.club_members` (active). **Community:** Platform SoT **missing** → blocked. |
| 7 | Browser client được gọi trực tiếp phần nào? | Sau Owner apply ACT-03: **SELECT** Club conversations/participants/messages/reactions/pins + **own** Club read cursors only. Hiện remote Staging vẫn deny-all. |
| 8 | Phần nào phải trusted backend? | Direct/System/Community; mọi write; reports; moderation; idempotency; RPCs; position counters; persistence events. |
| 9 | Fail-closed khi thiếu dependency? | Missing Club helper → ACT-03 SQL raise exception. Missing Community helper → keep deny-all. Missing identity → deny / gateway UNAVAILABLE. Typed `COMMUNICATION_AUTHORIZATION_DENIED`. |

## Hard rules

1. No UI/menu gate as authorization.
2. No localStorage / browser state as SoT.
3. No inventing Club/Community membership tables.
4. No `USING (true)` / `WITH CHECK (true)`.
5. No realtime publication in ACT-03.
6. Authored SQL ≠ applied.

## Runtime

- Repository ports unchanged.
- Production gateway remains fail-closed without certified deps.
- Browser must never hold service-role secrets.
- Typed authorization helpers under `src/features/communication/authorization/`.
