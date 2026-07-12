# Phase TT-2E — Atomic Publish Workflow

## Mục tiêu

Publish lineup giải đồng đội là **một command server-side duy nhất** cho toàn bộ matchup:

- Lineup A + B: `locked → published` đồng thời
- Matchup: `locked → published`
- `published_at` do server tạo
- Visibility hai bên mở trong cùng transaction
- Audit đầy đủ
- Triple version check + idempotency

## SQL

- File: `docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql`
- Fix patch (get_setup TT-2D shape): `docs/v5/PHASE_TT2E_GET_SETUP_FIX.sql` — **apply after main file**
- Staging only — **không** apply Production
- Functions:
  - `team_tournament_matchup_publish_ops` — `canPublish`, block codes
  - `team_tournament_publish_matchup` (6-param TT-2E + 4-param delegate)
  - Enhanced `team_tournament_get_setup` — `canPublish`, `publishOps`, lineup versions
  - Tightened `team_tournament_get_visible_lineups` — opponent chỉ sau matchup published

## Error codes

| Code | Ý nghĩa |
|------|---------|
| `matchup_not_locked` | Matchup chưa locked |
| `lineup_not_locked` | Lineup chưa locked |
| `lineup_missing` | Thiếu lineup row |
| `missing_policy_unresolved` | Policy thiếu lineup chưa xử lý |
| `manual_pending` | Còn manual_pending |
| `version_conflict` | Stale version |
| `already_published` | Đã publish |
| `publish_forbidden` | Không có quyền |
| `cross_tenant_denied` | Sai tenant |

## Client

- `atomicPublishWorkflowEngine.js` — canPublish / lineup versions
- `teamTournamentRpcService.js` — 6-param publish contract
- `cloudTeamTournamentRepository.publishLineups` — requires lineup A/B versions
- `TeamMatchupOperationsCard` — `canPublish` từ server, confirm tooltip
- `TeamTournamentSetup.handlePublish` — confirm + triple version

## Verify

```bash
node scripts/apply-phase-tt2e-staging-sql.mjs
node scripts/verify-phase-tt2e-staging.mjs
node --test tests/team-tournament-tt2e.test.js
```

## Evidence

- `docs/v5/qa-evidence/phase-tt2/TT2E_PUBLISH_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2E_ATOMICITY_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2E_VISIBILITY_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2E_CONCURRENCY_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2E_STAGING_SMOKE_REPORT.json`

## Production impact

**NONE** — staging SQL only, no Production deploy.

## Verdict gate

→ **READY FOR TT-3** khi tất cả evidence PASS và regression PASS.
