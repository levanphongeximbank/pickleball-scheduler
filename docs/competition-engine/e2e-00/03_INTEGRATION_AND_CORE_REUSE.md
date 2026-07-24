# E2E-00 — Integration Audit & Core Reuse Check

**HEAD:** `48c608b6` (`origin/main`)
**Isolation:** Consume Platform Core via public entry only. Do not edit `src/core/platform/**`. Parallel Platform Core Final Closure must not be assumed merged.

---

## 1. Integration readiness (3.7)

| Adapter | Canonical SoT | Contract | Runtime wiring | R/W | Tenant/venue | Permission | Failure behavior | Missing dependency | IND Pool+KO readiness |
|---------|---------------|----------|----------------|-----|--------------|------------|------------------|--------------------|----------------------|
| INT-01 Identity & Permission | `src/features/identity/` | CORE-02 `identityEvidencePort` | Default unavailable port; dormant | Read evidence → authz | `tenantId`/`venueId`/`competitionId` | Fail-closed deny | Null evidence → deny | Prod Identity→CORE-02 injection | **BLOCKING** until composition root |
| INT-02 Venue & Court | `src/features/venue-court/` | CAA + CORE-12 availability port | DI provider exists; needs root inject | Read availability | `clubId` required; optional `venueId` | Venue owns inventory | Fail-closed ports | Prod composition inject | **BLOCKING** for schedule/court assign |
| INT-03 Player Profile | `src/features/player/` | Core participants resolvers | Map-only / resolve; multi-source SoT | Mostly read → snapshot | Via player/club | Player privacy modes | Resolve fail / diagnostics | Unified person SSOT | **BLOCKING** for entry identity |
| INT-04 Club | `src/features/club/` | `MembershipStatusPort` | Stub/null in eligibility | Read membership | Club/tenant scoped | Club roles ≠ CORE-02 | Null → not member | Real Club membership port | **BLOCKING** for club-scoped IND |
| INT-05 Player Rating | player-rating / pick-vn-rating / Core rating | CORE-07 snapshot port; IND `ratingV5SeedAdapter` | Dual stacks; inject needed | Read snapshots | Competition/participant | Rating privacy | Required-port errors | Single rating provider | **BLOCKING** for seeding quality |
| INT-06 Ranking | `vpr-ranking` | Consume snapshot; don’t compute | Partial VPR bridge | Read | Tournament scoped | Platform projection | Module-local | Official CE↔VPR for seed (opt) | **NON-BLOCKING** |
| INT-07 Finance & Payment | `src/features/finance/` | `paymentStatusPort` | Finance not wired to Competition | Read status | Fee may carry competitionRef | Finance perms separate | UNKNOWN / not met | Finance→port adapter | **NON-BLOCKING** if fees optional |
| INT-08 CRM | `src/features/crm/` | None in CE | None | — | — | — | — | Entire boundary | **DEFERRED** |
| INT-09 Notification | `src/features/notifications/` | Match scheduled adapter | One-way boundary | Write notify | Tenant + competitionId | Recipient directory | Adapter-local fail | Broader event coverage | **NON-BLOCKING** draw; **P1** for ops UX |
| INT-10 File & Media | — | Explicitly out of CORE-22 | None | — | — | — | — | Media store | **DEFERRED** |
| INT-11 Streaming | — | None | None | — | — | — | — | Streaming port | **DEFERRED** |
| INT-12 External API & Federation | Platform descriptor projection | Descriptor only | Not live ports | — | — | — | — | Federation gateway | **DEFERRED** |

### Platform Core consumption rule

- Allowed: import from `src/core/platform` **public** exports already on `origin/main`.
- Forbidden: edit `src/core/platform/**` in Competition E2E worktree.
- If a required public API is absent on fresh `origin/main` → stop with:

```text
E2E_BLOCKED_BY_PLATFORM_CORE_GAP
```

- Before E2E merge: fetch `origin/main`; if Platform Core Final Closure changed public API, re-run affected tests.

---

## 2. Core reuse and ownership check

### Must reuse (do not re-implement)

| Domain capability | Canonical location | Root barrel? | E2E import rule |
|-------------------|--------------------|--------------|-----------------|
| Registration | `competition-core/registrations/`, `registration-eligibility/` | No (capability-local) | Import capability barrels |
| Eligibility | `registration-eligibility/` | No | Same |
| Division / classification | `classification/` | Partial factories on root | Prefer `classification/index.js` |
| Roster | `teams/` | Partial | `teams/index.js` |
| Lineup | `lineups/` | Yes (resolve + contracts) | Use Core; TT engines are legacy SoT for Team only |
| Seeding (CORE-07) | `seeding/` | No (`seed/` ≠ CORE-07) | Import `seeding/index.js` |
| Draw | `draw/` + `draw-runtime/` | `draw/` yes | Prefer draw + draw-runtime |
| Match generation | `match-generation/` | No | Import CORE-09; compose GROUP_RR + SINGLE_ELIM |
| Optimization | `optimizer/` | No | Capability-local if needed |
| Scheduling | `scheduling/` + `schedule-engine/` | `scheduling/` yes | Use public scheduling |
| Court assignment | `court-assignment/` | No | Import CORE-12 |
| Referee assignment | `referee-assignment/` | No | Import CORE-13 |
| Conflict resolution | `resource-conflict/` | No | Import capability-local |
| Lifecycle / workflow | `workflow/`, `matches/` | No | Import capability-local |
| Scoring | `scoring/` | No | Import CORE-16 |
| Validation | `result-validation/` | No | Import CORE-17 |
| Standings | `standings/` | Yes | Use root standings |
| Audit | `audit/` | No | Import CORE-20 |
| Replay | `deterministic-seed-replay/` | No | Import CORE-21 |
| Import/export | `import-export/` | Yes | Use root |
| Recovery | `recovery-resume/` | Yes | Use root |

### Competition Management reuse

| CM capability | Path | Production wired? |
|---------------|------|-------------------|
| Definition | `competition-definition` | **false** |
| Template instantiation | `template-instantiation` | **false** |
| Versioning | `competition-versioning` | **false** |
| Configuration | `competition-configuration` | **false** |
| Branding | `competition-branding` | **false** |
| Publication | `competition-publication` | **false** |
| Suspension/cancellation | `competition-suspension-cancellation` | **false** |
| Archive | `competition-archive` | **false** |

All CM modules: `wiredToProductionRuntime: false` on HEAD. E2E must wire via integrator composition — not by reopening CM workstreams.

### Known duplication risks (do not fork)

1. IND/TT legacy engines vs Core kernels (registration, standings, seeding, scoring).
2. Three referee score paths (classic / TT / referee-v5).
3. `seed/` vs `seeding/` vs CORE-21 naming collision.
4. Public portal mocks vs real live sync.
5. Identity audit vs competition audit.

### Integration gaps (record only — do not patch Core in E2E-00)

| Gap ID | Description | Owner |
|--------|-------------|-------|
| IG-01 | Many Core capabilities not on root barrel; integrator must use capability-local exports | E2E-01 |
| IG-02 | No composed Pool→KO strategy export | E2E-02 |
| IG-03 | CM templates lack dedicated IND Pool+KO seed | E2E-02 |
| IG-04 | Format adapters map-only / unwired | E2E-02 |
| IG-05 | Identity/Club/Rating ports not production-injected | E2E-01 |

If a required Core export is missing from **all** public surfaces → record as Core gap; do **not** edit Core in Competition E2E. Escalate separately.

---

## 3. Fail-closed invariants

E2E implementation must fail closed when missing:

- tenant scope
- venue/club scope (when required by competition)
- identity evidence
- permission decision
- canonical Core/CM contract

Mocks (`MOCK_LIVE_SCORES`, `MOCK_NEWS`, `MOCK_SPONSORS`, in-memory audit sinks used as sole proof) are **not** production readiness evidence.
