# TT-9 — iPhone Safari Checklist

**Device:** iPhone (iOS 17+)  
**Browser:** Safari  
**Role focus:** Captain + Referee  
**Environment:** Staging Preview only

---

## Pre-flight

- [ ] Private browsing OFF (session persistence test)
- [ ] Date/time automatic
- [ ] Staging URL bookmarked
- [ ] Test account credentials ready (Captain A, Referee 1)
- [ ] Screen recording enabled

## Captain scenarios

| ID | Step | Pass | Notes |
|----|------|------|-------|
| C01 | Open staging URL → login Captain A | ☐ | |
| C02 | Open Team Portal deep link | ☐ | |
| C03 | Select lineup for upcoming matchup | ☐ | |
| C04 | Save draft — verify toast | ☐ | |
| C05 | Submit lineup — verify submitted state | ☐ | |
| C06 | Deadline countdown visible and ticking | ☐ | |
| C07 | Pull-to-refresh — draft/submitted preserved | ☐ | |
| C08 | Logout → login — state correct | ☐ | |
| C09 | Before publish — opponent slots hidden/null | ☐ | |
| C10 | After BTC publish — opponent lineup visible | ☐ | |
| C11 | Stale version submit → conflict message | ☐ | |
| C12 | Network Link Conditioner 3G — submit works | ☐ | |
| C13 | Airplane mode at submit → queue/retry UX | ☐ | |

## Referee scenarios

| ID | Step | Pass | Notes |
|----|------|------|-------|
| R01 | Open referee link in Safari | ☐ | |
| R02 | Lineups visible post-publish | ☐ | |
| R03 | Enter draft sub-match score | ☐ | |
| R04 | Confirm result | ☐ | |
| R05 | Double-tap confirm — no duplicate | ☐ | |
| R06 | Kill network mid-request → retry | ☐ | |
| R07 | Navigate to second match | ☐ | |
| R08 | Expired token shows re-auth | ☐ | |
| R09 | Weak network — usable UI | ☐ | |

## Safari-specific

- [ ] No viewport overflow / horizontal scroll
- [ ] Bottom safe-area respected
- [ ] Date/time picker native behaviour OK
- [ ] Back gesture does not lose unsaved draft without warning

## Multi-session independence (mandatory)

**Invalid:** two ordinary Safari tabs on the same profile — cookies/session are shared.

**Valid setups (pick one):**

- [ ] Safari normal + Safari Private Browsing
- [ ] Safari + Chrome iOS with separate logged-in accounts
- [ ] Two Safari profiles with separate Apple IDs / accounts
- [ ] Two physical iPhones

**Evidence checklist (attach to report):**

- [ ] Account A identifier recorded
- [ ] Account B identifier recorded
- [ ] Proof sessions are isolated (private mode, separate browser, profile, or device)
- [ ] Timestamp for each concurrent action
- [ ] Screenshot or screen recording
- [ ] Conflict/concurrency outcome captured (error code or final state)

---

**Tester:** _______________  
**Date:** _______________  
**Build / preview URL:** _______________  
**Overall:** PASS ☐ / FAIL ☐ / BLOCKED ☐
