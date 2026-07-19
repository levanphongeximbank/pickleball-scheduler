# Phase 1F-B — In-Scope / Out-of-Scope Matrix

Companion to `04_PHASE_1F_B_PLAN_FREEZE.md`. Owner-approved 2026-07-20 (`APPROVE_PHASE_1F_B_PLAN`).

## In scope

| ID | Item | Sub-phase |
|----|------|-----------|
| B1 | `projectPublicPlayerProfile` (+ optional viewer helper) | 1F-B1 |
| B2 | Fail-closed normalize of null/malformed privacy on projection | 1F-B1 |
| B3 | Pure policy unit tests (allow/deny matrix) | 1F-B1 |
| B4 | `searchPlayers` public/directory mode via projector | 1F-B2 |
| B5 | Documented internal mode for ops facades (if retained) | 1F-B2 |
| B6 | Optional minimal public player card/route (projector-backed only) | 1F-B3 |
| B7 | Self privacy toggles edit UI if still missing (existing write path) | 1F-B2/B3 |
| B8 | Docs: public vs internal vs self; legacy club/ops = internal | 1F-B1–B3 |

## Out of scope

| ID | Item |
|----|------|
| X1 | Identity verification admin / privileged RPC UI |
| X2 | Link & dedupe tooling |
| X3 | Full `PlayerProfile.jsx` cutover from club V2 |
| X4 | Club blob / AI session player write retirement |
| X5 | Competition / Venue / Rating / Ranking / Notification feature rewrites |
| X6 | Treating `/players` club roster as public without Owner redesign |
| X7 | New Production schema migration / SQL apply / deploy |
| X8 | Expanding into Phase 1F C/D without `REVISE_SCOPE` |
