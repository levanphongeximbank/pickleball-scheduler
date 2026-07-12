# TT-9 — Mobile QA Plan

**Phase:** TT-9 preparation (Track B2)  
**Branch:** `qa/team-tournament-pilot-preparation`  
**Production impact:** NONE  
**Status:** Checklist preparation only — no mobile UI changes

---

## 1. Objective

Prepare device-specific checklists and report templates for real-device QA of Team Tournament pilot flows (BTC, Captain, Referee).

## 2. Minimum device matrix

| Device / browser | Checklist | Profile |
|------------------|-----------|---------|
| iPhone Safari | `TT9_IPHONE_SAFARI_CHECKLIST.md` | Primary mobile captain + referee |
| Android Chrome | `TT9_ANDROID_CHROME_CHECKLIST.md` | Primary mobile captain |
| Desktop Chrome or Edge | `TT9_DESKTOP_CHECKLIST.md` | BTC operations |
| Second browser profile | All checklists § Multi-session | Version conflict / dual tab |

## 3. Role scenarios

### Captain (Team Portal)

| ID | Scenario | Priority |
|----|----------|----------|
| C01 | Login | P0 |
| C02 | Deep-link to Team Portal | P0 |
| C03 | Select lineup | P0 |
| C04 | Save draft | P0 |
| C05 | Submit lineup | P0 |
| C06 | Countdown deadline visible | P0 |
| C07 | Refresh preserves state | P1 |
| C08 | Logout / login cycle | P1 |
| C09 | Before publish — opponent hidden | P0 |
| C10 | After publish — opponent lineup visible | P0 |
| C11 | Version conflict on submit | P0 |
| C12 | Slow network (3G throttle) | P1 |
| C13 | Offline at submit → retry | P0 |

### BTC (Tournament setup / director)

| ID | Scenario | Priority |
|----|----------|----------|
| B01 | Open tournament dashboard | P0 |
| B02 | View per-team lineup status | P0 |
| B03 | Randomize missing lineup | P0 |
| B04 | Lock lineups | P0 |
| B05 | Publish lineups | P0 |
| B06 | Assign courts | P1 |
| B07 | View audit trail | P1 |
| B08 | Version conflict on lock/publish | P0 |
| B09 | Two tabs same tournament | P0 |
| B10 | Refresh and reconnect | P1 |

### Referee (Team Referee Portal)

| ID | Scenario | Priority |
|----|----------|----------|
| R01 | Open portal via token/link | P0 |
| R02 | View lineup after publish | P0 |
| R03 | Enter draft score | P0 |
| R04 | Confirm result | P0 |
| R05 | Double tap / duplicate submit | P0 |
| R06 | Timeout then retry | P0 |
| R07 | Switch to another match | P1 |
| R08 | Token / session expiry | P0 |
| R09 | Weak network | P1 |

## 4. Offline / recovery checklist (documentation only)

Not implemented on this branch. Verify during TT-9 execution:

| State | Expected UX | Evidence |
|-------|-------------|----------|
| Action queued | User sees pending indicator | Screenshot + timestamp |
| Action sent | Spinner clears | Network log |
| Server confirmed | Success toast / status update | RPC response ID |
| Conflict | Non-destructive error + refresh prompt | Error code captured |
| Retry | Same idempotency key — no duplicate | Audit log |
| Stale page | Banner or forced refresh | Screen recording |
| Reconnect | Auto-resume or manual refresh | Console log |
| Duplicate prevention | Second submit ignored | DB command log |

## 5. Report templates

- Device test report: `templates/TT9_DEVICE_TEST_REPORT.json`
- Incident log: `templates/TT9_INCIDENT_LOG.md`

## 6. Execution rules (TT-9 on main branch)

- Staging / Preview only — never Production
- Two independent browser profiles for conflict tests
- Capture HAR or RPC log for P0 failures
- Do not modify mobile UI on QA prep branch

---

**Verdict (prep):** Checklists ready — await owner GO for TT-9 execution
