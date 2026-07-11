# Phase 43A — Direct Mutation Inventory

Classification:

- **A** — Read-only (`select`)
- **B** — Technical write (audit, session, avatar)
- **C** — Business mutation bypass RPC (**43A priority**)

---

## C — Business bypass (priority fix)

| # | File | Function / context | Line | Table | Op | Domain |
|---|------|-------------------|------|-------|-----|--------|
| C1 | `offlineQueue.js` | `syncCheckinAction` | 84 | `checkins` | insert | Check-in |
| C2 | `checkInService.js` | create checkin | 266 | `checkins` | insert | Check-in |
| C3 | `qrTokenService.js` | create token | 127 | `qr_tokens` | insert | Check-in |
| C4 | `notificationDispatchService.js` | dispatch | 123 | `notifications` | insert | Notifications |
| C5 | `notificationService.js` | push subscribe | 135 | `push_subscriptions` | upsert | Notifications |
| C6 | `notificationService.js` | disable push | 166 | `push_subscriptions` | update | Notifications |
| C7 | `supabaseBillingStore.js` | hydrate write | 74 | billing tables | upsert | Billing |
| C8 | `supabaseSuggestionStorage.js` | save suggestion | 71 | `ai_suggestions` | insert | AI |
| C9 | `supabaseChecklistStorage.js` | save checklist | 59 | `ai_workflow_checklists` | upsert | AI |
| C10 | `courtEngineCloudStore.js` | sync store | 173 | `court_engine_active_sessions` | upsert | Courts |
| C11 | `teamTournamentCloudSync.js` | header sync | 198 | `team_tournaments` | upsert | Team tournament |
| C12 | `cloudSync.js` | `syncToSupabase` | 131–137 | `club_data_v3` | REST POST | Blob (all operational) |
| C13 | `matchLiveSync.js` | fallback update | ~300+ | `tournament_match_live` | update | Tournament |
| C14 | `supabaseIntegrationStore.js` | settings | 93 | `tenant_integration_settings` | upsert | Integrations |
| C15 | `identityAdminCreateService.js` | create profile | 96 | `profiles` | upsert | Profiles |
| C16 | `identityAdminResetPasswordService.js` | — | 42 | `profiles` | update | Profiles |

---

## B — Technical write

| File | Line | Table | Notes |
|------|------|-------|-------|
| `auditService.js` | 128 | `audit_logs` | Best-effort audit |
| `supabaseIntegrationAuditRepository.js` | 33 | `integration_audit_logs` | API audit |
| `avatarUploadService.js` | 75 | storage bucket | Avatar |

---

## A — Read-only (sample)

| File | Line | Table |
|------|------|-------|
| `checkInService.js` | 59 | `checkins` select |
| `billingVenueService.js` | 26, 60 | `venues` select |
| `courtClusterCloudSync.js` | 66, 78 | clusters select |
| `userManagementService.js` | 81 | `profiles` select |

---

## 43A wave 1 scope (implement)

| ID | Action |
|----|--------|
| C1, C2 | Add scope check + request_id in payload; plan RPC wrapper |
| C13 | Gate/remove direct fallback when `isSecureRuntime()` |
| C12 | Tenant/user/version guard before push (containment) |

## Deferred (43B+)

C7 billing, C8–C9 AI, C10 court engine full RPC, C11 team tournament header.

---

## CI recommendation (43A)

Add script `scripts/audit-direct-mutations.mjs` — fail CI if new `.from(...).insert|update|upsert|delete` added under `src/features/` without allowlist entry.

---

## Evidence

Generated from static grep 2026-07-11; cross-ref `PHASE_42N_RPC_CONCURRENCY_MATRIX.md`.
