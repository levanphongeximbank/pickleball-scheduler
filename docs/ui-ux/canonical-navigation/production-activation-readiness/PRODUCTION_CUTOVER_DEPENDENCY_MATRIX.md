# Production Cutover Dependency Matrix

**Program:** PICK_VN Canonical Navigation  
**Baseline:** `origin/main` @ `f81b6c8f0c43af3f5b25dc09e688fe534f70d64c`  
**Mode:** Read-only audit  
**Twin:** [`PRODUCTION_CUTOVER_DEPENDENCY_MATRIX.json`](./PRODUCTION_CUTOVER_DEPENDENCY_MATRIX.json)

## Legend

| Class | Meaning |
|-------|---------|
| SATISFIED | Met for Production activation planning; evidence on main |
| SATISFIED_WITH_OBSERVATION | Met with retained observation / partial evidence |
| MUST_CLOSE_BEFORE_PRODUCTION | Required before Production flag ON |
| MAY_DEFER_WITH_OWNER_ACCEPTANCE | May remain open if Owner explicitly accepts |
| OUT_OF_SCOPE | Not required for shell activation |

---

## Matrix

| ID | Prerequisite | Classification | Evidence / note |
|----|--------------|----------------|-----------------|
| D-01 | Route registry stability (179/179, duplicates 0) | **SATISFIED** | Phase 4/5 coverage on main |
| D-02 | Route guard stability | **SATISFIED** | Phase 4 runtime cutover + Phase 5 automated gates |
| D-03 | Role normalization | **SATISFIED_WITH_OBSERVATION** | Package A SUPER_ADMIN→PLATFORM_ADMIN-eq; literal PLATFORM_ADMIN absent |
| D-04 | Tournament Engine authorization | **SATISFIED_WITH_OBSERVATION** | Automated 7/7 PASS; manual UI NOT_TESTED in Phase 5 |
| D-05 | B03 Rating V5 shadow restrictions | **SATISFIED_WITH_OBSERVATION** | Automated 9 PASS; manual shadow URL NOT_TESTED |
| D-06 | Private Pairing restrictions | **SATISFIED_WITH_OBSERVATION** | Automated/static PASS; manual UI NOT_TESTED |
| D-07 | Public route behavior | **SATISFIED_WITH_OBSERVATION** | Automated/static PASS; manual unauth Preview NOT_TESTED |
| D-08 | Direct-link behavior | **SATISFIED** | Phase 5 coverage PASS |
| D-09 | Browser refresh | **MUST_CLOSE_BEFORE_PRODUCTION** | Phase 5 NOT_TESTED — retest on Production or Owner accept |
| D-10 | Browser back/forward | **MUST_CLOSE_BEFORE_PRODUCTION** | Phase 5 NOT_TESTED — retest or Owner accept |
| D-11 | Mobile navigation | **SATISFIED_WITH_OBSERVATION** | Preview mobile PASS; tablet NOT_TESTED |
| D-12 | Accessibility + high contrast | **MUST_CLOSE_BEFORE_PRODUCTION** | Keyboard automated PASS; high contrast NOT_TESTED |
| D-13 | Tenant selector UI (OBS-UI-01) | **MAY_DEFER_WITH_OWNER_ACCEPTANCE** | Non-blocker for nav; retained observation |
| D-14 | `/messages` inactive (OBS-RUNTIME-01) | **MAY_DEFER_WITH_OWNER_ACCEPTANCE** | Feature activation separate from shell |
| D-15 | CRM authority (OBS-RUNTIME-02) | **MAY_DEFER_WITH_OWNER_ACCEPTANCE** | CRM authority separate |
| D-16 | MISSING_IDENTITY_LINK (OBS-DATA-01) | **MAY_DEFER_WITH_OWNER_ACCEPTANCE** | Staging data; Production data Owner-scoped |
| D-17 | Non-admin role coverage | **MUST_CLOSE_BEFORE_PRODUCTION** | Preview largely SUPER_ADMIN-only manual; need Prod matrix or waiver |
| D-18 | COACH schema gap | **MAY_DEFER_WITH_OWNER_ACCEPTANCE** | `WAIVED_WITH_KNOWN_SCHEMA_GAP`; backlog OPEN |
| D-19 | Monitoring plan + owner | **MUST_CLOSE_BEFORE_PRODUCTION** | OD-PA-05 partial: thresholds + merge freeze bound; monitoring owner / duration / interval still unbound |
| D-20 | Rollback owner + procedure | **MUST_CLOSE_BEFORE_PRODUCTION** | Preview pattern proven; Production rollback owner still unbound |
| D-21 | Deployment owner | **MUST_CLOSE_BEFORE_PRODUCTION** | Unbound (OD-PA-05) |
| D-22 | Operator identity | **MUST_CLOSE_BEFORE_PRODUCTION** | Production-safe operator unbound |
| D-23 | Maintenance window | **MUST_CLOSE_BEFORE_PRODUCTION** | Unbound (OD-PA-05) |
| D-24 | Acceptance window | **MUST_CLOSE_BEFORE_PRODUCTION** | Unbound (OD-PA-05) |
| D-25 | Rollback trigger thresholds | **MUST_CLOSE_BEFORE_PRODUCTION** | Default thresholds bound via OD-PA-05; still require execution-window ops GO |
| D-26 | Production flag OFF attestation (live) | **MUST_CLOSE_BEFORE_PRODUCTION** | OD-PA-06 mechanics acknowledged; live Vercel attestation pending |
| D-27 | Explicit PRODUCTION_GO + flag/redeploy GOs | **MUST_CLOSE_BEFORE_PRODUCTION** | OD-PA-02: all execution GOs remain NO |
| D-28 | OBS-P5-PM-01 auto-deploy control | **SATISFIED_WITH_OBSERVATION** | Known; OD-PA-05 merge freeze = YES for activation window |
| D-29 | Critical automated suites 99/99 | **SATISFIED** | Post-merge evidence |
| D-30 | Preview flag-ON + rollback pattern | **SATISFIED** | Phase 5 PASS_WITH_OBSERVATIONS + rollback PASS |
| D-31 | Dual shell absence | **SATISFIED** | Exclusive MainLayout branch |
| D-32 | Netlify as Production host for this cutover | **OUT_OF_SCOPE** | Phase 5 bound Vercel; confirm Production host = Vercel |
| D-33 | COACH schema remediation execution | **OUT_OF_SCOPE** | Separate backlog; not required if waiver continues |

---

## Counts

| Classification | Count |
|----------------|------:|
| SATISFIED | 6 |
| SATISFIED_WITH_OBSERVATION | 7 |
| MUST_CLOSE_BEFORE_PRODUCTION | 13 |
| MAY_DEFER_WITH_OWNER_ACCEPTANCE | 5 |
| OUT_OF_SCOPE | 2 |
| **Total (D-01–D-33)** | **33** |

Note: D-09/D-10/D-12 may move to MAY_DEFER if Owner explicitly accepts residual risk for Production GO; until then they remain MUST_CLOSE.
