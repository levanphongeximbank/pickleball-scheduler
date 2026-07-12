# Phase TT-3 — BTC Controlled Lineup Override

**Status:** Staging only · Production impact: **NONE**

## Scope

BTC/Tournament Director controlled lineup override:

- Override locked or published lineups
- Mandatory reason (elevated ≥15 chars if matchup started)
- Before/after revision in `team_tournament_lineup_revisions`
- Version + idempotency via TT-1B command log
- Audit via `team_tournament_write_audit`
- `requires_republish` + visibility reset until TT-2E atomic republish

**Not in TT-3:** TT-4 forfeit, TT-5 referee token, TT-6 realtime, DreamBreaker, confirmed result edits.

## Server RPC

| RPC | Purpose |
|-----|---------|
| `team_tournament_override_lineup` | Atomic override command |
| `team_tournament_get_lineup_override_ops` | Server-side `canOverride` gate |
| `team_tournament_matchup_publish_ops` | Republish-aware publish readiness |
| `team_tournament_publish_matchup` | Republish after override |
| `team_tournament_get_visible_lineups` | Hide opponent when `requires_republish` |

## SQL

- `docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql`
- `docs/v5/PHASE_TT3_GET_SETUP_PATCH.sql`

Apply staging:

```bash
node scripts/apply-phase-tt3-staging-sql.mjs
node scripts/verify-phase-tt3-staging.mjs
```

## Client

| Layer | Path |
|-------|------|
| Engine | `src/features/team-tournament/engines/overrideLineupWorkflowEngine.js` |
| State machine | `src/features/team-tournament/engines/lineupStateMachine.js` |
| Repository | `cloudTeamTournamentRepository.overrideLineup` |
| BTC UI | `TeamLineupOverrideDialog`, `TeamMatchupOperationsCard`, `TeamTournamentSetup` |
| Captain | `TeamPortal` — blocked edit + “chờ công bố lại” |
| Referee | `TeamRefereePortal` — blocked when `requiresRepublish` |

## Business rules

| Case | Rule |
|------|------|
| A — not started | BTC (`team_tournament_can_manage` or `team.lineup.override`) |
| B — started, no confirmed | Super Admin / `tournament.update` only; reason ≥15 chars |
| C — any confirmed sub-match | Block `lineup_override_blocked_confirmed_result` |

## Evidence

- `docs/v5/qa-evidence/phase-tt3/TT3_OVERRIDE_REPORT.json`
- `docs/v5/qa-evidence/phase-tt3/TT3_REVISION_REPORT.json`
- `docs/v5/qa-evidence/phase-tt3/TT3_VISIBILITY_REPUBLISH_REPORT.json`
- `docs/v5/qa-evidence/phase-tt3/TT3_STAGING_SMOKE_REPORT.json`

## Verdict gate (TT-4)

**READY FOR TT-4** only when override atomic, confirmed block, validation, version/idempotency, revision/audit, republish visibility, UI, regression, and staging smoke all PASS.

## Known limitations (post-TT-3)

1. **TT-2D randomize vs TT-2C strict submit** — Server `team_tournament_randomize_lineup` đôi khi tạo mixed pair không pass validator strict (`p_is_submit=true`) mà TT-3 override bắt buộc dùng. Đây là gap TT-2D/TT-2C, không phải lỗi override path.
2. **Không che lỗi runtime** — TT-3 không sửa fixture/probe data trong app runtime để né validation; staging verify script chỉ prep probe tournament (documented).
3. **Tracking issue** — Randomize builder phải sinh lineup gender-valid + reuse-safe trước lock/override. Tạo GitHub issue: **TT-2D randomize builder: mixed pairs fail strict TT-2C validation** (body mẫu: `.tmp-tt2d-randomize-issue.md` — `gh` CLI chưa có trên máy dev; owner tạo issue thủ công).
