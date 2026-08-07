# Canonical Navigation — Production Activation Final Evidence

**Program:** PICK_VN Canonical Navigation  
**Artifact:** `PRODUCTION_ACTIVATION_FINAL_EVIDENCE`  
**Machine-readable:** [`PRODUCTION_ACTIVATION_FINAL_EVIDENCE.json`](./PRODUCTION_ACTIVATION_FINAL_EVIDENCE.json)  
**Evidence recorder:** Le Phong  
**Recorded at:** `2026-08-07T12:02:00+07:00` (`Asia/Ho_Chi_Minh`)  
**Mode:** Evidence and closure preparation only — no runtime, env, SQL, Auth, or Production data mutation in this authoring  

**Bound execution package:** `docs/ui-ux/canonical-navigation/production-execution-package/`  
**`EXECUTION_PACKAGE_DIGEST`:** `fda262a74832daf9356ca8bd6744deaaf3e82e15d17bda19cc4957dbb3fbcdce`

---

## Final evidence verdict

**`CANONICAL_NAVIGATION_PRODUCTION_ACTIVATION_EVIDENCE_COMPLETE_READY_FOR_CLOSURE_REVIEW`**

Upstream operational verdict (monitoring complete):

**`CANONICAL_NAVIGATION_PRODUCTION_ACTIVATION_PASS_MONITORING_COMPLETE`**

---

## Bound identifiers

| Field | Value |
|-------|--------|
| Final execution SHA | `ed90dea944e59200b0451f1381f0d3d2fc4934c9` |
| Execution package digest (SHA-256) | `fda262a74832daf9356ca8bd6744deaaf3e82e15d17bda19cc4957dbb3fbcdce` |
| Vercel project | `pickleball-scheduler` / `prj_glU9Gr0zPaNoMlTcIJCAHVk5UowG` |
| Production domain / alias | `https://pickvn.app` |
| Production canonical flag | `VITE_CANONICAL_APP_SHELL_ENABLED` |
| Flag evaluation mode | Vite build-time (`import.meta.env`) |
| Operating mode | `OWNER_ONLY_CONTROLLED_PILOT` |

---

## Flag transition

| Field | Value |
|-------|--------|
| Pre-activation classification | **ABSENT** (`PRODUCTION_FLAG_BEFORE=ABSENT`) |
| Post-activation state | **`true`** (`VITE_CANONICAL_APP_SHELL_ENABLED=true`) |
| Transition | **ABSENT → true** |
| Redeploy required to bake flag | **YES** (completed) |
| Flag present in Production env after activation | **YES** (encrypted env entry observed during monitoring) |

---

## Deployments

| Role | Deployment ID | URL slug | Created (+07) | Status | Notes |
|------|---------------|----------|---------------|--------|-------|
| Pre-activation Production | `dpl_7TDZFtCMpWMc5nvvXp6zhsMDq3Ry` | `pickleball-scheduler-hl103nnar-pickleball-scheduler.vercel.app` | `2026-08-07T08:15:48+07:00` | READY | Immediate prior Production deployment before activation redeploy |
| Pre-activation GitHub Production deploy SHA (chronological prior) | — | — | — | — | `8196fa98882b4db676ce6094311e1b37c202a11c` |
| Activated Production (active) | `dpl_6ii6KmpyChmSMTzdrqH3FVDBKVcy` | `pickleball-scheduler-3ma0nwrdc-pickleball-scheduler.vercel.app` | `2026-08-07T10:13:00+07:00` | READY | Serves `https://pickvn.app`; source SHA `ed90dea944e59200b0451f1381f0d3d2fc4934c9` |

| Alias check | Result |
|-------------|--------|
| `https://pickvn.app` assigned to activated deployment | **YES** (verified across monitoring window) |
| Activated deployment remained newest Production active through monitoring | **YES** |

---

## Owner browser acceptance

**Verdict:** `OWNER_BROWSER_ACCEPTANCE_VERDICT=PASS`  
**`ROLLBACK_REQUIRED`:** **NO**

### Public / unauthenticated

| Check | Result |
|-------|--------|
| `PUBLIC_ROOT_PASS` | **YES** |
| `PUBLIC_HOME_PASS` | **YES** |
| `PUBLIC_CLUBS_PASS` | **YES** |
| `PUBLIC_COURTS_PASS` | **YES** |
| `INVALID_CLUB_ROUTE_PASS` | **YES** |
| `INVALID_COURT_ROUTE_PASS` | **YES** |

### Owner / SUPER_ADMIN

| Check | Result |
|-------|--------|
| `OWNER_LOGIN_PASS` | **YES** |
| `OWNER_SUPER_ADMIN_PASS` | **YES** |
| `DASHBOARD_PASS` | **YES** |
| `TOURNAMENT_PASS` | **YES** |
| `PRIVATE_PAIRING_PASS` | **YES** |
| `RATING_V5_ROUTE_PASS` | **YES** |

### Shell exclusivity

| Check | Result |
|-------|--------|
| `CANONICAL_SHELL_VISIBLE` | **YES** |
| `LEGACY_SHELL_PRIMARY` | **NO** |

### Devices

| Check | Result |
|-------|--------|
| `DESKTOP_PASS` | **YES** |
| `TABLET_PASS` | **YES** |
| `MOBILE_PASS` | **YES** |

### Critical negatives

| Check | Result |
|-------|--------|
| `BLANK_PAGE` | **NO** |
| `REDIRECT_LOOP` | **NO** |
| `AUTH_LOOP` | **NO** |
| `CRITICAL_LAYOUT_FAILURE` | **NO** |
| `CRITICAL_RUNTIME_ERROR_OBSERVED` | **NO** |
| `UNEXPECTED_DATA_MUTATION` | **NO** |

Identity-dependent non-admin allow/deny and tenant-isolation cells remain **`WAIVED_BY_OWNER`** for this Owner-only pilot (not PASS). Waivers expire before any non-Owner user or second tenant is enabled.

---

## Post-activation monitoring (60 minutes)

| Field | Value |
|-------|--------|
| Monitoring start | `2026-08-07T10:55:00+07:00` |
| Monitoring end | `2026-08-07T11:55:00+07:00` |
| Timezone | `Asia/Ho_Chi_Minh` |
| Interval | **5** minutes |
| Duration | **60** minutes |
| Checkpoints completed | **12** (+ final close) — all OK |
| Monitoring result | **PASS** |
| Closure verdict | `CANONICAL_NAVIGATION_PRODUCTION_ACTIVATION_PASS_MONITORING_COMPLETE` |

### Monitoring invariants held

| Invariant | Result |
|-----------|--------|
| Activated deployment remained READY | **YES** |
| `https://pickvn.app` remained on `dpl_6ii6KmpyChmSMTzdrqH3FVDBKVcy` | **YES** |
| Deployment source SHA remained `ed90dea…` | **YES** |
| Flag remained present / expected ON | **YES** |
| `origin/main` unchanged at `ed90dea…` | **YES** |
| No unrelated Production deployment | **YES** |
| No rollback condition detected | **YES** |
| Spot HTTP `https://pickvn.app/` | **200** throughout checks |

---

## Rollback status

| Field | Value |
|-------|--------|
| `ROLLBACK_REQUIRED` | **NO** |
| `ROLLBACK_PERFORMED` | **NO** |
| Rollback triggers fired | **NONE** |
| Rollback deployment ID | **N/A** |

---

## Known non-blocking observations (preserved)

| ID | Classification | Detail |
|----|----------------|--------|
| `OBSERVATION_CANONICAL_TOPBAR_01` | **LOW** / `LOW_NON_BLOCKING` | Tenant/admin selector text visually overlaps in canonical topbar |
| `OBSERVATION_PUBLIC_NETWORK_01` | `NON_CRITICAL_PUBLIC_CONTENT_BACKEND_GAP` | `news_public_content_query_public` returns HTTP 404 |
| Public fallback | `PUBLIC_FALLBACK_HANDLED=YES` | Homepage safely falls back |
| Homepage notice | `EXPLICIT_MOCK_ONLY` / `KNOWN_OBSERVATION` | Demo-data notice displayed; not reclassified as failure |

These were **not** reclassified as new failures; behavior did not materially worsen during monitoring.

---

## Mutation attestation (evidence window)

| Class | Count / status |
|-------|----------------|
| SQL executions | **0** |
| Auth / identity mutations | **0** |
| Production data mutations | **0** |
| Runtime code changes (this evidence authoring) | **0** |
| Vercel env changes (this evidence authoring) | **0** |
| Redeploys (this evidence authoring) | **0** |
| Branch / worktree cleanup | **NO** (`POST_MERGE_CLEANUP_GO=NO`) |

---

## Closure preparation pointer

See [`PRODUCTION_ACTIVATION_CLOSURE_PREPARATION.md`](./PRODUCTION_ACTIVATION_CLOSURE_PREPARATION.md).

This evidence package is ready for Owner closure review. It does **not** by itself authorize post-merge cleanup, broader rollout past Owner-only pilot, or removal of Owner waivers.
