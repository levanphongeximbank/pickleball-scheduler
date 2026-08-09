# Team Tournament Staging Court Seed — Package 01

**Status:** LOCAL PACKAGE ONLY — **DO NOT APPLY** without separate Owner GO.  
**Workstream:** `TEAM-TOURNAMENT-PR412-LIVE-CERT-BLOCKER-REMEDIATION-01`

## Why

Format & Venue loads courts via `loadCourtsForClub` → `club_data_v3.data.courts`.  
Staging club `club-ecebf64c78f948ccb2b59842441eb26c` currently has **no** `club_data_v3` row (court inventory = 0). This is a **data** gap, not an app bug.

## Target

| Key | Value |
|-----|-------|
| Project | `qyewbxjsiiyufanzcjcq` |
| Club | `club-ecebf64c78f948ccb2b59842441eb26c` |
| Tenant / venue | `venue-staging-a` |
| Courts | `tt412-court-01`, `tt412-court-02` |

## Apply order (Owner GO)

1. `01_PRECHECK.sql`
2. `02_SEED.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql`

After apply, Preview must pull club cloud blob (or refresh club context) so Format & Venue checkboxes appear.
