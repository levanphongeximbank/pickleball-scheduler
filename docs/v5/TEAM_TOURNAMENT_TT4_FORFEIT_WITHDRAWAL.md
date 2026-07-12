# Phase TT-4 — Forfeit, Withdrawal & Technical Result Workflow

## Mục tiêu

Hoàn thiện workflow thua kỹ thuật / rút giải server-side cho giải đồng đội:

- Sub-match forfeit (no_show, injury, invalid_lineup, …)
- Team withdrawal
- Technical score configurable (`settings.technicalScoreDefaults`)
- Confirmed result protection (`forfeit_blocked_confirmed_result`)
- Standings recalc atomic
- Audit đầy đủ
- BTC + Referee UI

**Staging only — Production impact = NONE**

## SQL

| File | Nội dung |
|------|----------|
| `docs/v5/PHASE_TT4_FORFEIT_WITHDRAWAL.sql` | Schema, helpers, RPC |
| `docs/v5/PHASE_TT4_GET_SETUP_PATCH.sql` | forfeitOps, withdrawn, forfeitCount |

### RPC

- `team_tournament_apply_forfeit` — atomic sub-match forfeit
- `team_tournament_withdraw_team` — team withdrawal + future matchups
- `team_tournament_sub_match_forfeit_ops` — server readiness helper

## Pilot rules

- Sub-match forfeit: ảnh hưởng BXH + hiệu số; **không** Elo
- Technical score mặc định 11–0 (configurable)
- Lý do bắt buộc
- BTC hoặc referee (`can_manage_results`) được apply forfeit
- Chỉ BTC được withdraw team
- Không ghi đè sub-match đã confirmed bình thường

## Client

- `forfeitWorkflowEngine.js` — validation, technical score, payload builder
- `TeamForfeitDialog.jsx` — BTC + Referee
- `TeamWithdrawTeamDialog.jsx` — BTC withdraw
- Repository: `applyForfeit`, `withdrawTeam`

## Apply staging

```bash
node scripts/apply-phase-tt4-staging-sql.mjs
node scripts/verify-phase-tt4-staging.mjs
```

## Verdict gate (TT-5)

**READY FOR TT-5** khi forfeit, withdrawal, standings, audit, UI, regression, staging smoke PASS.
