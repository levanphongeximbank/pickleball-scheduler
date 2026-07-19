# Club Phase 2F — Scenario QA Matrix

Legend: **CODE_CERTIFIED** = automation/fixture/code inspection. Live UI PASS requires visual/Staging (blocked).

| # | Scenario | Method | Expected | Actual | Result | Evidence |
|---|----------|--------|----------|--------|--------|----------|
| 1 | Owner ≠ President | Automation | Distinct labels | Distinct | **CODE_CERTIFIED PASS** | 2F test 8 |
| 2 | Owner = President | Automation | Combined label; count 1 officer | OK | **CODE_CERTIFIED PASS** | 2F test 9 |
| 3 | No President | Automation | `Chưa gán` | OK | **CODE_CERTIFIED PASS** | 2F test 10 |
| 4 | No VP | Automation | `—` | OK | **CODE_CERTIFIED PASS** | 2F test 11 |
| 5 | One VP | Automation | 1 slot | OK | **CODE_CERTIFIED PASS** | 2F test 11 |
| 6 | Two VPs | Automation | 2 slots | OK | **CODE_CERTIFIED PASS** | 2F test 11 |
| 7 | Missing display name | Automation | `Chưa có thông tin` | OK | **CODE_CERTIFIED PASS** | 2F test 12 |
| 8 | Missing avatar | Code inspection | Avatar optional; no crash | Hook hydrates `avatar_url` only | **CODE_CERTIFIED PASS** | read service |
| 9 | Inactive member ref | Automation | `stale_reference` | OK | **CODE_CERTIFIED PASS** | 2F test 13 |
| 10 | Removed/left ref | Automation | stale | OK | **CODE_CERTIFIED PASS** | 2F test 13 |
| 11 | Loading | Automation + source | Loading UI Home/Manage/Org/Gov | Wired | **CODE_CERTIFIED PASS** | 2F test 14 |
| 12 | Read error | Source + contract | Error + Thử lại | Wired | **CODE_CERTIFIED PASS** | 2F test 14 |
| 13 | Empty Club | Code | Zero members / unassigned | Count path + unassigned labels | **CODE_CERTIFIED PASS** | member-count doc |
| 14 | Long VN names | Source contract | `wordBreak: break-word` Org/Gov | Present | **CODE_CERTIFIED PASS** | 2F test 24 |
| 15 | Duplicate display names | Code | Distinguishes via role context | Chips + titles | **CODE_CERTIFIED PASS** | UI structure |
| 16 | Mobile narrow | Source contract | Members `md` breakpoint; dialogs fullWidth | Present | **CODE_CERTIFIED PASS** | 2F test 24 |
| 17 | Desktop wide | Source | Same components | Present | **CODE_CERTIFIED PASS** | layout |
| 18 | Slow response | Code | Loading state until ready; no infinite loop | Hook seq + inFlight | **CODE_CERTIFIED PASS** | hook source |
| 19 | Refresh after mutation | Automation + source | `handleMutationResult` / reload | Wired S3/S4/S6 | **CODE_CERTIFIED PASS** | 2F test 15 |
| 20 | VERSION_CONFLICT refetch | Automation | refresh reason VERSION_CONFLICT | OK | **CODE_CERTIFIED PASS** | 2F test 15 |

**Live visual:** all rows → **NOT live-verified** (see VISUAL_QA_BLOCKED).
