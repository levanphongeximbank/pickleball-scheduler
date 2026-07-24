# COMMS-06 — Messaging Experience

**Status:** Implemented (UI + experience gateway; **demo/in-memory only**)  
**Module:** `src/features/communication/experience/`  
**Route:** `/messages`  
**Menu:** nhóm **Giao tiếp** → **Tin nhắn** (`communication-messaging`)

CRM outreach `/crm/messages` **không** phải Communication SoT và không bị ghi đè.

---

## Route / menu inventory

| Surface | Value |
|---------|--------|
| Route | `/messages` |
| Router registration | `src/router.jsx` → `MessagingExperiencePage` |
| Menu group | `messaging` / label `Giao tiếp` |
| Menu leaf | key `communication-messaging`, text `Tin nhắn`, icon `chat` |
| Route permissions | `ROUTE_PERMISSIONS["/messages"] = []` (authenticated shell; fail-closed nếu `hasUi` tắt) |
| Unread badge | Communication gateway `getUnreadBadge()` — **không** dùng Notification inbox |

---

## Screen inventory

| Screen / region | Desktop | Mobile |
|-----------------|---------|--------|
| Tabs: Cá nhân / Câu lạc bộ / Cộng đồng / Yêu cầu trò chuyện | Top tabs | Top tabs (scrollable) |
| Conversation / channel list | Left column | Full screen |
| Active conversation thread | Center column | Full screen when opened |
| Details (user / club / channel) | Right column | Bottom drawer / sheet |
| Composer | Bottom of thread | Bottom of thread (not covered by chrome) |

---

## Desktop / mobile behavior

- **Desktop / tablet (`md+`):** three-column grid — list · thread · details.
- **Mobile (`< md`):** list full-screen → open conversation → back button → details via info button + bottom `Drawer`.
- Loading / empty / error + **Thử lại** on list and thread.
- Unread chips use text labels (not color alone).

---

## Direct / Club / Community flows

### Direct

- List conversations with counterpart **profile projection** (display name only — no email/phone).
- Latest preview, unread, open/resolve, send, reply, mark read.
- Conversation requests: accept / decline / cancel.
- Access decision banner: `ALLOW` | `REQUEST_REQUIRED` | `DENY`.
- Block user; report message (experience-layer report store for Direct until app command exists).

### Club

- Lists channels the viewer may access for demo club.
- Kinds: `GENERAL` | `ANNOUNCEMENT` | `PRIVATE` | `TEAM` | `MANAGEMENT`.
- Unread, archived/read-only, send/reply, pin/unpin (policy-gated), details.
- Announcement composer flag `canComposeAnnouncement` only when policy allows.
- Suspended/removed membership reflected as limited access state.
- **Does not** own Club membership SoT.

### Community

- Lobby + `TOPIC` / `REGION` / `SUPPORT`.
- Visibility: `PUBLIC` | `JOIN_REQUIRED` | `RESTRICTED` | `READ_ONLY`.
- Join/leave, send/reply, slow-mode remaining time, pin/unpin, report.
- Moderation (when allowed): hide, suspend, ban, restore.
- Rule notice + banned/suspended/read-only states.

---

## Gateway boundary

`Communication Experience Gateway` (`matchesCommunicationExperienceGateway`):

- listDirectConversations / listDirectRequests / listClubChannels / listCommunityChannels
- loadMessages / sendMessage / replyMessage / markRead
- request/accept/decline/cancel direct
- join/leave community
- block / report / pin / unpin
- moderation actions
- subscribe / unsubscribe (signal-only)

UI **must not** import SQL rows or Supabase clients. View models are frozen projections without `email` / `phone` / `rawRow`.

---

## Demo / in-memory limitation

`createDemoMessagingExperienceGateway()`:

- Adapter marker: `IN_MEMORY_DEMO`, `productionReady: false`
- Seeds deterministic demo Direct / Club / Community data
- Uses COMMS-02/03/04 application composers + in-memory repos
- In-process realtime adapter only (`signalOnly: true` → UI reloads)
- **Not** Staging/Production persistence
- **Not** remote realtime publication

---

## Accessibility

- Tablist labeled; icon buttons have `aria-label`
- Message list uses `article` / `section` semantics
- Menus have accessible names
- Focus moves to composer on reply
- Loading announced via `role="status"` / `aria-live`
- Color is not the only unread/access signal (chips include text)

---

## Security rendering rules

- Message body is **text-only** (`sanitizeMessageBodyForDisplay` strips tags)
- No `dangerouslySetInnerHTML`
- Composer length guarded by `MESSAGE_BODY_MAX_LENGTH` (experience layer; domain currently requires non-empty only)
- Attachment control visible but **disabled** (no upload runtime)

---

## COMMS-05 activation dependency

UI may run against demo gateway **now**. Wiring a production gateway requires COMMS-05 gates:

- SQL apply (Staging first)
- Trusted backend client (deny-all client RLS)
- Realtime publication still deferred; keep signal + reload pattern
- No Notification delivery claims

---

## COMMS-07 readiness

**READY_WITH_CONDITIONS**

COMMS-07 (integration / activation hardening) can proceed when:

1. Staging persistence activated under COMMS-05 gates
2. Experience gateway gains a non-demo adapter implementing the same port
3. PlayerDisplayPort wired for richer projections (still no email/phone in UI state)
4. Direct block/report application commands promoted from experience-layer helpers if required for production audit

---

## Explicit non-scope

- No SQL apply / remote Supabase / realtime publication enablement
- No Notification / push delivery
- No file upload / voice / video / livestream
- No E2E encryption / AI moderation / production word-filter
- No full-text search / production deploy
- No package or lockfile changes
- No Club Management / CRM / Competition SoT edits beyond route/menu registration

---

## Tests

| Suite | Runner | Path |
|-------|--------|------|
| Gateway / navigation / invariants | `node --test` via unit registry | `tests/communication-comms06-messaging-experience.test.js` |
| UI smoke | Vitest (`npm run test:ui`) | `tests/ui/messaging-experience.ui.test.jsx` |
| COMMS-01…05 regression | existing `tests/communication-*.test.js` | registry |
