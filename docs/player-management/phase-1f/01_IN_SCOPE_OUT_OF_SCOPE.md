# Phase 1F — In-Scope / Out-of-Scope Matrix

Companion to `00_PHASE_1F_SCOPE_FREEZE.md`. Owner-approved 2026-07-20.

## In scope

| ID | Item | Sub-phase |
|----|------|-----------|
| I1 | Self read-model mapping for Phase 1E foundation fields | 1F-A |
| I2 | Athlete (and aligned My Profile) edit UI: `birth_date`, `handedness`, `activity_region`, privacy toggles; consistent `birth_year` | 1F-A |
| I3 | Read-only self display of `identity_verification_status` | 1F-A |
| I4 | Stale auth / companion field-list cleanup that contradicts durable writer | 1F-A |
| I5 | Focused UI + service tests for foundation fields and forbidden verification write | 1F-A |
| I6 | Privacy settings persistence via existing `updateSelfProfile` → durable path | 1F-A / 1F-B |
| I7 | Fail-closed public profile projector | 1F-B |
| I8 | Privacy filtering on `searchPlayers` / directory paths introduced in 1F | 1F-B |
| I9 | Optional minimal public/directory surface **only** behind projector | 1F-B |

## Out of scope

| ID | Item |
|----|------|
| O1 | Identity verification admin workflow / privileged RPC UI |
| O2 | Link & dedupe tooling |
| O3 | Full `PlayerProfile.jsx` cutover from club V2 athlete stack |
| O4 | Club blob / AI session player write retirement |
| O5 | Competition / Venue / Rating / Ranking / Notification feature changes |
| O6 | New Production schema migration |
| O7 | Production SQL apply / deploy without separate Owner gate |
| O8 | Expanding Phase 1F into C or D without Owner `REVISE_SCOPE` |
