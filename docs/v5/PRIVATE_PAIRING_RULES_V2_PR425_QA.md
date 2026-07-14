# PR-4.25 — QA

## Targeted tests

```
node --test \
  tests/canonical-club-repository.test.js \
  tests/canonical-membership-repository.test.js \
  tests/canonical-player-repository.test.js \
  tests/private-pairing-pr425-canonical-picker.test.js
```

Expected: **22 PASS**.

## ACCC fixture expectations

| Check | Expected |
|-------|----------|
| Club repository sees ACCC | PASS |
| Membership → 10 unique active users | PASS |
| Player pool not empty (blob empty) | PASS |
| mappedPlayers | 5 |
| unmappedMembers | 5 |
| default-club excluded | PASS |
| options only mapped playerIds | PASS |

Fixture: `tests/fixtures/accc-cloud-only-club.js` (no real PII).

## Regression

| Suite | Result |
|-------|--------|
| PR-2 / PR-3 / PR-4 / PR-5 private pairing | PASS (56) |
| club-registry-42k | Included in pairing batch PASS |
| club-active-membership | **1 pre-existing FAIL** (`MyClubPage` expects `resolveMyActiveClubMembership` string) — unrelated to PR-4.25 |

## Flag matrix

| Club flag | Player flag | Behavior |
|-----------|-------------|----------|
| OFF | OFF | Legacy blob/registry (current Production-safe default) |
| ON | ON | V2 clubs + membership players; blob not required |

## Manual smoke (Staging only when flags ON)

1. SUPER_ADMIN → Private Pairing admin.
2. GLOBAL Rule Set → CLB nguồn list has no `default-club`.
3. Club with cloud members + empty blob → mapping summary shows mapped/unmapped.
4. Save rule → only mapped `player_id` persisted.
5. Attempt unmapped id → blocked (`PLAYER_MAPPING_REQUIRED`).

## Production

No flag enablement, no backfill, no migration in PR-4.25.
