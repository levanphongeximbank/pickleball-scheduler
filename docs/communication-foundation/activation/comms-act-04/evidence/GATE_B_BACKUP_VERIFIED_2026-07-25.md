# COMMS-ACT-04 — Gate B Backup Verification

**Recorded:** 2026-07-25  
**Owner marker:** `BACKUP_COMPLETE`  
**Verdict:** **PASS**

## Directory

`C:\Users\Le Phong\PICK_VN-Backups\supabase-staging\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-20260725-101205`

## Dump artifacts

| File | Bytes | SHA256 (recomputed = manifest) |
|------|------:|--------------------------------|
| roles.sql | 297 | `25873cec56a2cc6514e204f420231777f85c03da818caa7090cdcdfa89776ecd` |
| schema.sql | 1275770 | `94f034debe91f69e687fa4eb15a0d24b40b77d2f6b1ceab66d26917ed8c5d523` |
| data.sql | 2101072 | `a0d1af13871d51b7259c0f4add0141a311615696d4168f9d171540b4e044d0b0` |
| migration-history-schema.sql | 1116 | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| migration-history-data.sql | 893838 | `d9bb21be10f00ac229970361bfae3796f065e0b82add3c78a1d6243db2060c09` |

- Manifest rows: 5  
- Manifest re-hash: **PASS**  
- All entries non-empty: **PASS**

## ZIP

| Field | Value |
|-------|-------|
| Path | `...\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-20260725-101205.zip` |
| Bytes | `553363` (> 0) |
| SHA256 | `cddbad9fca12e331cbe25cbe4cc965b4e6aebc0d0a92def353bc7446a05a4bf4` (64 chars) |
| Entries | 7 / none empty |

Required entries present: roles/schema/data/migration-history-schema/migration-history-data + backup-manifest.csv + backup-evidence.txt.

## Owner GO binding

File: `comms-act-04-owner-go-evidence.txt`

| Field | Observed | Expected | Pass |
|-------|----------|----------|:----:|
| OWNER_GO_TOKEN | `OWNER GO COMMS-ACT-04 STAGING CLUB_SELECT_ONLY` | same | YES |
| SCOPE | `CLUB_SELECT_ONLY` | same | YES |
| STAGING_PROJECT_REF | `qyewbxjsiiyufanzcjcq` | same | YES |
| PRODUCTION_PROJECT_REF_BLOCKED | `expuvcohlcjzvrrauvud` | same | YES |
| FORWARD_SQL_SHA256 | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` | repo forward | YES |
| FORWARD_SQL_BYTES | `13173` | repo forward | YES |
| ROLLBACK_SQL_SHA256 | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` | repo rollback | YES |
| ROLLBACK_SQL_BYTES | `8808` | repo rollback | YES |
| REMOTE_SQL_APPLIED | NO | NO | YES |
| REALTIME_ENABLED | NO | NO | YES |
| CLIENT_RLS_OPENED | NO | NO | YES |

`backup-evidence.txt`: `targetProjectRef=qyewbxjsiiyufanzcjcq`; Production free-text absent; `scope=CLUB_SELECT_ONLY`.

## Notes

- ACT-02 backup directories were **not** used as ACT-04 primary.
- No passwords/tokens/dumps committed to repo.
