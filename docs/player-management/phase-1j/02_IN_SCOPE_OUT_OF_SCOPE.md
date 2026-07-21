# Phase 1J — In-Scope / Out-of-Scope Matrix

Companion to `01_PHASE_1J_SCOPE_FREEZE.md`.  
**Owner decision:** `APPROVE_PHASE_1J_SCOPE`  
**Classification:** **A — Production Directory Operational Hardening**  
**Freeze date:** 2026-07-21 (UTC+7)

---

## In scope

| ID | Item | Sub-phase |
|----|------|-----------|
| I1 | Phase 1J discovery + scope freeze documentation | 1J-0 |
| I2 | Staging eligible public athlete fixture pack (QA-labeled) | 1J-A |
| I3 | Staging privacy / masking live sample evidence | 1J-B |
| I4 | Production read-only browser smoke matrix for `/athletes` and detail | 1J-C |
| I5 | Confirm empty eligible directory is a valid product state | 1J-C / 1J-D |
| I6 | Nav-once / president “Vận hành CLB” / sidebar–mobile parity regression | 1J-C |
| I7 | Scoped UX defect fix **only if** proven by 1J-C/D (no scope expansion) | 1J-D |
| I8 | Re-run 1I deterministic directory + nav regression suites | 1J-D / gate |
| I9 | Optional directory search index SQL package (additive) | 1J-E (optional) |
| I10 | Phase 1J closure / certification docs | 1J-F |

---

## Out of scope

| ID | Item |
|----|------|
| O1 | Anonymous / hybrid PublicLayout directory productization |
| O2 | Directory DTO expansion beyond locked 1I fields |
| O3 | Rating, ranking, club membership, venue, social, messaging, SEO surfaces |
| O4 | Production fixture seeding / Production profile writes (default) |
| O5 | Self-service verification / self → `pending` |
| O6 | Admin verification workflow rewrite; rejection-reason schema; bulk verify |
| O7 | Full Admin Player Management / ops dossier rewrite |
| O8 | Legacy V2 `PlayerProfile` / club-blob / AI session player write cutover |
| O9 | Duplicate identity link / merge tooling |
| O10 | Broad Player audit / change-history product |
| O11 | Self-profile polish wave (Candidate C) without `REVISE_SCOPE` |
| O12 | CRM “Phase 1J” UI migration / CRM localStorage cutover |
| O13 | Competition / Venue / Rating / Ranking / Notification feature rewrites |
| O14 | Reopening Phase 1I-B forward SQL as a redesign (use optional 1J-E only) |
| O15 | Production deploy / frontend redeploy as a phase goal |
| O16 | Expanding into deferred candidates without Owner `REVISE_SCOPE` |

---

## Deferred boundaries

| Item | Requires |
|------|----------|
| Anonymous directory | `REVISE_SCOPE` + SQL gate |
| Self-service verification | `REVISE_SCOPE` + SQL gate |
| Verification ops UX (rejection reason, bulk) | `REVISE_SCOPE` (+ SQL if schema) |
| Self-profile polish | `REVISE_SCOPE` |
| Full Admin Player Management | `REVISE_SCOPE` |
| Legacy cutover / dedupe | `REVISE_SCOPE` |
| CRM UI Phase 1J | Separate CRM Owner authorize (not PM 1J) |
| Optional 1J-E indexes | Separate SQL authoring/apply tokens (still under PM 1J optional path) |

---

## Environment matrix

| Action | Staging | Production |
|--------|---------|------------|
| Docs / tests | Yes | N/A |
| Fixture create/update | Only with Owner write token | **No** (default) |
| Privacy sample reads | Yes | Read-only smoke only |
| Browser matrix | Optional | Yes (read-only; Owner smoke token) |
| Optional index SQL apply | After SQL Staging token | After SQL Production token |
