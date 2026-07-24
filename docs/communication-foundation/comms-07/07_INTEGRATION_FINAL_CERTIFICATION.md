# COMMS-07 — Integration Hardening & Final Certification

**Status:** Structure COMPLETE · Local/demo READY · Staging persistence `GO_STAGING_PERSISTENCE` · Client RLS / realtime / Production BLOCKED
**Module:** `src/features/communication/runtime/` + experience/provider wiring
**Route:** `/messages`
**Menu:** nhóm **Giao tiếp** → **Tin nhắn** (`communication-messaging`)

CRM outreach `/crm/messages` **không** phải Communication SoT và không bị ghi đè.

---

## Final readiness statement

| Surface | Status |
|---------|--------|
| **Structure** | COMPLETE |
| **Local/demo** | READY |
| **Remote persistence (Staging)** | APPLIED (deny-all) — COMMS-ACT-02 |
| **Client RLS** | FAIL-CLOSED (not opened) |
| **Realtime** | NOT ENABLED |
| **Production** | BLOCKED |

Communication Foundation đạt **100% cấu trúc** sau COMMS-07. Staging schema/deny-all đã apply (ACT-02). Client RLS mở, realtime publication, và Production vẫn bị chặn có chủ đích.

---

## What COMMS-07 delivered

1. **Production Experience Gateway** — `createProductionMessagingExperienceGateway`  
   Injected COMMS-02/03/04 application services + COMMS-05 realtime/persistence seams.  
   No Supabase singleton. No raw row leakage. No Notification delivery. No membership SoT writes.

2. **Runtime provider & modes** — `DEMO` | `PRODUCTION` | `UNAVAILABLE`  
   - `DEMO` only on development / preview / test when allowed  
   - Production builds never fall back to demo  
   - Missing deps → `UNAVAILABLE` with user copy “Tính năng chưa được kích hoạt”  
   - Query parameters cannot enable demo

3. **Identity / tenant / authorization boundary**  
   - `actorId` from authenticated context only (UI override ignored)  
   - Club/Community membership via canonical readers — fail-closed when evidence missing  
   - Profile display via PlayerDisplayPort or safe identifier fallback (no email/phone default)

4. **Realtime signal adapter boundary**  
   - Conversation-scoped subscribe + authorize-before-subscribe  
   - Envelope validation, duplicate suppression, out-of-scope drop + typed diagnostic  
   - Signal → UI reload from persistence (never SoT)  
   - Unsubscribe / cleanup on provider unmount

5. **Fail-closed route/menu**  
   - `/messages` + menu Tin nhắn honor runtime mode  
   - UNAVAILABLE renders activation message — no demo data

6. **Error / observability**  
   - Stable experience codes (unauthorized / forbidden / not activated / network / conflict / validation / stale)  
   - Safe diagnostic events (no body / token / PII)

7. **Activation matrix + Staging runbook** (authored, not executed)

---

## Activation matrix

| Gate | Status | Condition to READY |
|------|--------|--------------------|
| Local/demo | READY | Explicit demo surface (dev/preview/test) |
| Code integration | READY | COMMS-07 complete |
| Staging SQL | READY (`GO_STAGING_PERSISTENCE`) | COMMS-ACT-02 evidence 2026-07-24 |
| Client RLS | BLOCKED | Canonical Club/Community membership SQL mapping + negative access tests |
| Realtime publication | BLOCKED | Scope inventory + auth/catch-up smoke + rollback procedure |
| Production | BLOCKED | All Staging gates pass |

Do **not** fake READY for remote gates.

---

## Runtime inventory

| Artifact | Path |
|----------|------|
| Runtime modes / markers | `src/features/communication/runtime/constants.js` |
| Mode resolver | `src/features/communication/runtime/resolveCommunicationRuntimeMode.js` |
| Experience error mapping | `src/features/communication/runtime/experienceErrors.js` |
| Unavailable gateway | `src/features/communication/runtime/createUnavailableMessagingExperienceGateway.js` |
| Production gateway | `src/features/communication/runtime/createProductionMessagingExperienceGateway.js` |
| Bootstrap | `src/features/communication/runtime/communicationRuntime.js` |
| Provider | `src/features/communication/runtime/CommunicationRuntimeProvider.jsx` |
| Layout mount | `src/layouts/MainLayout.jsx` (beside NotificationRuntimeProvider) |
| Page guard | `src/features/communication/experience/MessagingExperiencePage.jsx` |

---

## COMMS-06 continuity

COMMS-06 UI, view models, demo gateway, and accessibility rules remain.  
COMMS-07 adds the production composition path and fail-closed runtime selection.  
Demo gateway is retained for local DX only and is marked `productionReady: false`.

---

## Explicit non-scope (unchanged)

- No remote SQL apply / Supabase Staging or Production migration
- No remote realtime publication enablement
- No deploy / Production open
- No permissive RLS
- No Notification / push delivery
- No file upload / voice / video / AI moderation
- No package or lockfile changes
- No Club Management / Player Management / CRM / Competition SoT edits beyond minimal route/menu/runtime registration

---

## Tests

| Suite | Runner | Path |
|-------|--------|------|
| Runtime / gateway / auth / realtime | `node --test` via unit registry | `tests/communication-comms07-integration-final-certification.test.js` |
| COMMS-01…06 regression | existing communication tests | registry |
| UI smoke | Vitest | `tests/ui/messaging-experience.ui.test.jsx` |

---

## Next Owner action

Follow [`07_STAGING_ACTIVATION_RUNBOOK.md`](./07_STAGING_ACTIVATION_RUNBOOK.md) **only after Owner GO** — do not run apply from COMMS-07.
