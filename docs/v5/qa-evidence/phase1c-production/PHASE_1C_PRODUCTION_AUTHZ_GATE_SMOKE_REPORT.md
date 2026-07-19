# Phase 1C — Production Authz Gate Smoke

- **Status:** **PASS**
- **Club:** `club-219e4a7cbd73437eb6271f02a53314c3`
- **Original Owner restored:** `4cf24ed0-99f8-4997-b803-3c7ff8e32014`
- **Final version:** 38 (controlled QA bumps + restore)

## Assign / Clear matrix

All required actors PASS (ALLOW / FORBIDDEN / NOT_AUTHENTICATED / VERSION_CONFLICT / MEMBER_REQUIRED).

Unrelated actor: initial fixture failed sign-in (`Email not confirmed`); retested with confirmed ephemeral user → **FORBIDDEN** for assign and clear; no version bump; no Owner change.

## Proof

- tenant_staff denied: true
- VENUE_MANAGER denied: true
- COURT_MANAGER denied: true
- Optional Club Owner path disabled: true

## Version / audit

- assign 35→36 + `club.assign_owner` audit
- clear 36→37 + `club.clear_owner` audit
- restore Owner → version 38

## UI consistency

Canonical `club_get` owner matches restored Owner (no app redeploy).
