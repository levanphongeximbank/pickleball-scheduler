# E2E-01 — Adapter Inventory

| Code | Name | Status | Evidence |
|------|------|--------|----------|
| INT-01 | Identity & Permission | **IMPLEMENTED_IN_E2E_01** | Identity matrix → `IdentityEvidencePort` |
| INT-02 | Venue & Court | **IMPLEMENTED_IN_E2E_01** | CAA + descriptors → CORE-12 DI bridge |
| INT-03 | Player Profile | **IMPLEMENTED_IN_E2E_01** | Player public read → participant lookup |
| INT-04 | Club | **IMPLEMENTED_IN_E2E_01** | Club membership lookup → `MembershipStatusPort` |
| INT-05 | Player Rating | **IMPLEMENTED_IN_E2E_01** | Injected rating read → CORE-07 snapshot port |
| INT-06 | Ranking | **PARTIAL** | VPR bridge optional; not required for Pool+KO seed-by-rating |
| INT-07 | Finance & Payment | **CONTRACT_ONLY** | `paymentStatusPort` null→UNKNOWN; fees optional |
| INT-08 | CRM | **DEFERRED_TO_LATER_E2E_WORKSTREAM** | No CE port |
| INT-09 | Notification | **PARTIAL** | `emitMatchScheduledFromBoundary` exists; expand in ops waves |
| INT-10 | File & Media | **DEFERRED_TO_LATER_E2E_WORKSTREAM** | Out of CORE-22 |
| INT-11 | Streaming | **DEFERRED_TO_LATER_E2E_WORKSTREAM** | No CE port |
| INT-12 | External API & Federation | **DEFERRED_TO_LATER_E2E_WORKSTREAM** | Descriptor ≠ live ports |

Runtime mirror: `buildAdapterInventory()` in `src/features/competition-engine/integration/inventory/adapterInventory.js`.
