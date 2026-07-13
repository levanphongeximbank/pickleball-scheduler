# TT-5D Implementation — Referee Safety Completion

**Phase:** TT-5D  
**Branch:** `feature/tt5-referee-v5-integration`  
**Production impact:** NONE (staging only)

## Deliverables

| Layer | Files |
|-------|--------|
| SQL | `TT5-D_ASSIGNMENT_SAFETY.sql`, `TT5-D_REOPEN_RESULT_REVISION.sql`, `TT5-D_CORRECTION_WORKFLOW.sql`, `TT5-D_SECURITY_GUARDS.sql` |
| Client | `teamRefereeV5SafetyEngine.js`, `RefereeV5TeamMatchPage.jsx`, `TeamRefereeSafetyPanel.jsx` |
| Scripts | `apply-phase-tt5d-staging-sql.mjs`, `verify-phase-tt5d-staging.mjs` |
| Tests | `tests/team-tournament-tt5d.test.js` |

## Capabilities

1. **Assignment scope** — `team_tournament_create_referee_assignment` with tenant/tournament/matchup/sub-match/match_id/version/expiry.
2. **Revoke** — `team_tournament_revoke_referee_assignment` (reason required, version conflict, audit).
3. **Access guard** — `team_tournament_referee_match_access_ops` for `/referee/match/:matchId?tournamentId=`.
4. **Correction** — request (referee) + approve/reject (BTC) → new revision + outbox + TT-5C consumer.
5. **Reopen** — `team_tournament_reopen_referee_match` → void revision + standings rebuild.
6. **Mobile/workspace** — status banners (active/expired/revoked/read-only/correction pending).

## Apply (staging)

```bash
node scripts/apply-phase-tt5d-staging-sql.mjs
node scripts/verify-phase-tt5d-staging.mjs
```

## Verdict gate

See evidence JSON under `docs/v5/qa-evidence/phase-tt5/TT5D_*`.
