# Phase 1G — In-Scope / Out-of-Scope Matrix

Companion to `00_PHASE_1G_SCOPE_FREEZE.md`. Owner-approved 2026-07-20 (`APPROVE_PHASE_1G_SCOPE`).

## In scope

| ID | Item | Sub-phase |
|----|------|-----------|
| I1 | Athlete edit UI for `birth_date`, `handedness`, `activity_region`, privacy toggles; consistent `birth_year` | 1G-A |
| I2 | Persist via `updateSelfProfile` → `updateAuthenticatedSelfPlayerProfile` → durable Player path | 1G-A |
| I3 | Reload confirmation via `useAuthenticatedSelfPlayerProfile` / foundation panel | 1G-A |
| I4 | Keep `identity_verification_status` read-only (no self-edit control) | 1G-A |
| I5 | Focused UI + service tests for edit/persist/validation + forbidden verification write | 1G-A |
| I6 | My Profile field parity for foundation fields where product-appropriate | 1G-B (optional) |
| I7 | Stale Identity companion field-list cleanup / docs alignment | 1G-B (optional) |

## Out of scope

| ID | Item |
|----|------|
| O1 | Identity verification admin workflow / privileged RPC UI (was 1F-C) |
| O2 | Link & dedupe tooling |
| O3 | Full `PlayerProfile.jsx` cutover from club V2 athlete stack (was 1F-D) |
| O4 | Club blob / AI session player write retirement (was 1F-D) |
| O5 | Public player directory UI (was 1F-B3) |
| O6 | Admin player management / ops dossier rewrite |
| O7 | Competition / Venue / Rating / Ranking / Notification feature changes |
| O8 | New Production schema migration |
| O9 | Production SQL apply / deploy without separate Owner gate |
| O10 | Expanding Phase 1G into C / D / E without Owner `REVISE_SCOPE` |
