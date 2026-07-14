# TT-11 — Backup Checklist

**Environment:** Staging ☐ / Production ☐  
**Tournament ID:** _______________  
**Production impact during backup:** Read-only export only

---

## Pre-backup

- [ ] Owner approval obtained (name: ________, date: ________)
- [ ] Maintenance window communicated to pilot participants
- [ ] Backup operator identified
- [ ] Rollback runbook printed / bookmarked

## Backup scope

| Item | Include | Method |
|------|---------|--------|
| `team_tournaments` | ☐ | Supabase export / SQL dump |
| `team_tournament_teams` | ☐ | |
| `team_tournament_players` | ☐ | |
| `team_tournament_matchups` | ☐ | |
| `team_tournament_lineups` | ☐ | RPC snapshot |
| `team_tournament_sub_matches` | ☐ | |
| `team_tournament_standings` | ☐ | |
| `team_tournament_command_log` | ☐ | |
| `team_tournament_audit` | ☐ | |
| Club blob (`club_data_v3`) | ☐ | Blob export JSON |
| Feature flag snapshot | ☐ | Env screenshot |

## Execution

| Step | Field | Value |
|------|-------|-------|
| Backup start time | | |
| Backup end time | | |
| Supabase project ref | | |
| Export file path(s) | | |
| File checksum (SHA256) | | |

## Verification

- [ ] Row counts match pre-export query
- [ ] Sample tournament JSON parses
- [ ] Command log idempotency keys present
- [ ] Backup stored off-project (separate storage)
- [ ] Restore test on non-prod clone (date: ________)

## Owner approval

- [ ] Owner reviewed backup manifest
- [ ] Approved to proceed with pilot: Yes ☐ / No ☐
