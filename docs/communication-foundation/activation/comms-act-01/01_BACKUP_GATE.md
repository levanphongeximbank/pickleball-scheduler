# COMMS-ACT-01 — Backup Gate

## Minimum evidence before Staging apply

| Field | Description |
|-------|-------------|
| backupTimestamp | ISO time backup completed |
| targetProjectRef | Must be `qyewbxjsiiyufanzcjcq` |
| backupMechanism | Supabase PITR, Dashboard backup, or logical export (CSV/SQL dump of relevant schemas) |
| backupStatus | Must be success |
| restoreCapability | Documented restore steps or restore drill note |
| retention | Retention window for the backup artifact |
| confirmedBy | Owner or designated operator |
| evidenceLocation | Path under `docs/communication-foundation/activation/comms-act-01/evidence/` |

## Env tokens (never commit values)

- `COMMS_STAGING_BACKUP_EVIDENCE` — opaque approval/evidence token
- `COMMS_STAGING_BACKUP_EVIDENCE_PATH` — relative path to filled evidence note

## Insufficient backup

If Staging plan cannot provide safe backup/PITR and no logical export evidence exists:

- Apply verdict = **BLOCKED**
- Do not invent fake backup
- Do not recommend Production apply
- Optional Staging-only recovery: **delete Staging project → recreate → re-run `docs/SUPABASE-STAGING-CHECKLIST.md`** (platform convention). This is disposable project reset, not Production-safe rollback.

## Rollback after Communication data exists

- Prefer **restore from backup** / forward-fix
- `docs/supabase-communication-comms05-rollback.sql` is **destructive DROP** — safe only before meaningful data
