# RLS Test Plan — v3.5.6

Kế hoạch kiểm thử bảo mật staging. Gồm test **client RBAC** (unit) và test **thủ công Supabase** (staging).

## A. Unit tests (mock)

Chạy: `npm run test:unit`.

| File | Case | Kỳ vọng |
|------|------|---------|
| `tests/rls-access.test.js` | RBAC bật, thiếu profile | `resolveAuthUserFromProfile` → từ chối |
| `tests/rls-access.test.js` | User `suspended` | `can()` → false mọi permission |
| `tests/rls-access.test.js` | VENUE_OWNER sai `venue_id` | `canAccessVenue` → false |
| `tests/rls-access.test.js` | CLUB_OWNER sai `club_id` | `canAccessClub` → false |
| `tests/rls-access.test.js` | PLAYER sai scope | permission → false |
| `tests/referee-rpc-security.test.js` | Token hợp lệ | RPC trả đúng 1 trận, không `club_id` |
| `tests/referee-rpc-security.test.js` | Token sai / quá ngắn | Không trả dữ liệu |
| `tests/referee-rpc-security.test.js` | Anon REST `select *` | Permission denied (mock RLS) |
| `tests/referee-rpc-security.test.js` | Referee update RPC | Chỉ token khớp mới update |
| `tests/referee-rpc-security.test.js` | Staff select | List theo `club_id` + `tournament_id` OK |
| `tests/referee-rpc-security.test.js` | Dev fallback | RPC chưa deploy → direct select theo token |

## B. Manual — profiles

| # | User | Hành động | Kỳ vọng |
|---|------|-----------|---------|
| B1 | SUPER_ADMIN | SQL: `select * from profiles` | Thấy mọi profile |
| B2 | VENUE_OWNER venue-a | Đọc profiles cùng venue | OK (staff select) |
| B3 | PLAYER | Đọc profile user khác qua API | Từ chối |
| B4 | User mới signup | Không có row profiles (xóa thủ công) + RBAC on | Login từ chối |
| B5 | suspended | `status = suspended` | Login từ chối / không permission |

## C. Manual — club_data_v3

| # | User | Hành động | Kỳ vọng |
|---|------|-----------|---------|
| C1 | SUPER_ADMIN | Pull club bất kỳ | OK |
| C2 | VENUE_OWNER venue-a | Pull club `venue_id = venue-a` | OK |
| C3 | VENUE_OWNER venue-a | Pull club `venue_id = venue-b` | Từ chối / empty |
| C4 | CLUB_OWNER club-1 | Pull `club_id = club-1` | OK |
| C5 | CLUB_OWNER club-1 | Pull `club_id = club-2` | Từ chối |
| C6 | CASHIER | Pull club venue (read) | OK nếu venue khớp |
| C7 | CASHIER | Push/sync ghi club | Từ chối (không trong write roles) |
| C8 | PLAYER | Pull club của mình | OK (read) |
| C9 | PLAYER | Push/sync ghi club | Từ chối |
| C10 | Anon (không login) | REST GET club_data_v3 | Từ chối sau RLS |

## D. Manual — tournament_match_live

| # | User | Hành động | Kỳ vọng |
|---|------|-----------|---------|
| D1 | Director (CLUB_OWNER) | Upsert match live | OK (authenticated) |
| D2 | Referee anon | Mở `/referee/:token` đúng | Thấy 1 trận qua RPC |
| D3 | Referee anon | Đổi token URL sai | Không thấy trận |
| D4 | Anon | REST `GET tournament_match_live?select=*` | **Từ chối** (không policy anon select) |
| D5 | Anon | DELETE row | Từ chối |
| D6 | Anon | RPC `referee_get_match_by_token` token đúng | 1 row JSON (không `club_id`) |
| D7 | Anon | RPC `referee_update_match_score` token sai | `null` |
| D8 | PLAYER authenticated | List match giải CLB khác | Từ chối |

## E. Manual — payment_events

| # | User | Hành động | Kỳ vọng |
|---|------|-----------|---------|
| E1 | VENUE_OWNER | Select payment venue mình | OK |
| E2 | CASHIER | Select payment venue mình | OK |
| E3 | ACCOUNTANT | Select payment venue mình | OK |
| E4 | PLAYER | Select payment_events | Từ chối |
| E5 | VENUE_OWNER venue-b | Select payment venue-a | Từ chối |

## F. App UI smoke (staging URL)

| # | Role | Route / action |
|---|------|----------------|
| F1 | SUPER_ADMIN | `/`, `/players`, `/settings`, cloud sync |
| F2 | VENUE_OWNER | `/court-management`, tạo CLB |
| F3 | VENUE_MANAGER | `/select-players`, không `/settings` manage |
| F4 | CASHIER | `/court-management/bookings` |
| F5 | CLUB_OWNER | `/club`, `/tournament` |
| F6 | PLAYER | `/tournament`, `/statistics`; không `/players` |
| F7 | Referee | `/referee/:token` không sidebar app |

## G. Pass criteria staging

- [ ] Tất cả unit tests pass
- [ ] B1–B5 pass
- [ ] C1–C10 pass (trừ C10 nếu chưa bật RLS — bắt buộc trước preview)
- [ ] D1–D8 pass
- [ ] E1–E5 pass
- [ ] F1–F7 pass

## Ghi chú referee

Referee **không** là RBAC role. Bảo vệ dựa trên:

1. Token dài / unique trong URL (≥ 16 ký tự)
2. Anon **không** có policy SELECT/UPDATE trực tiếp trên `tournament_match_live`
3. RPC `referee_get_match_by_token` + `referee_update_match_score` (security definer, token-scoped)
4. App `/referee/:token` chỉ gọi RPC (fallback direct chỉ khi dev chưa chạy RLS SQL)
5. Referee poll 4s; Director vẫn dùng Realtime authenticated
