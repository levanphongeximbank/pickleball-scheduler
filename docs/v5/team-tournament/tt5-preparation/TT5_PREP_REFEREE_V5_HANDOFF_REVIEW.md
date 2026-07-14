# TT-5 Preparation — Referee V5 Handoff Review

**Phase:** TT-5 PREPARATION  
**Date:** 2026-07-13  
**Handoff document:** `docs/v5/referee-v5/REFEREE_V5_INTEGRATION_HANDOFF.md`

---

## Review verdict

```text
Referee integration handoff: PASS (documentation complete)
Runtime handoff readiness:   FAIL (source not committed to git)
```

---

## Handoff completeness checklist

| Section | Required | Present | Notes |
|---------|----------|---------|-------|
| Runtime modules | Yes | Yes | Engines, adapters, visualizer, realtime, edge |
| Excluded from production | Yes | Yes | Prototype route, fixtures, QA scripts |
| Environment variables (names only) | Yes | Yes | No secret values |
| Database migrations | Yes | Yes | V5A through V5E1 |
| API contract | Yes | Yes | get-state, apply-command, finalize, realtime, outbox |
| Known limitations | Yes | Yes | Offline, MLP, production NO |
| TT identity bridge | Partial | Yes | Proposed sub_match_id mapping — needs TT-5A owner sign-off |

---

## Handoff vs git source gap

The handoff describes **complete runtime modules** on disk, but git cannot reproduce them:

| Handoff claim | Verified on disk | Verified in git |
|---------------|------------------|-----------------|
| 77-file referee-v5 module | Yes | **No** |
| Edge function | Yes (untracked) | **No** |
| Unit tests 133/133 | Evidence says PASS | Tests untracked |
| Staging SQL applied | MCP confirms tables/RPCs | SQL files untracked |
| Router `/dev/referee-v5` | Yes | **Partial** (`824a639` stub only) |

**Blocker:** TT-5A cannot audit reproducible integration from git until Referee V5 is committed to a named branch.

---

## Handoff vs staging runtime

| Check | Result | Method |
|-------|--------|--------|
| `match_live_states` exists | PASS | MCP staging |
| Referee V5 RPCs (9 functions) | PASS | MCP staging |
| Edge `referee-v5-match` deployed | PASS | `phase-v5d3/EDGE_DEPLOY_REPORT.json` |
| Realtime publication | PASS | `match_live_states` in `supabase_realtime` |
| Production untouched | PASS | MCP production — zero `match_*` referee tables |
| HTTP 18/18 | PASS | `phase-v5d41/HTTP_18_OF_18_REPORT.json` |
| Browser E2E 25/25 | PASS | `phase-v5d41/` |
| Realtime E2E 8/8 | PASS | `phase-v5e1/` |

---

## Handoff exclusions — confirmed appropriate

| Exclusion | Risk if integrated | Review |
|-----------|-------------------|--------|
| `/dev/referee-v5` | Exposes prototype to operators | Correct to exclude |
| Staging fixtures | Wrong players/courts in prod | Correct |
| verify-referee scripts | Bundle bloat | Correct — keep in scripts/ |
| QA passwords | Secret leak | Correct |
| LocalPrototypeAdapter in prod path | Bypasses server authority | Must gate in TT-5B |

---

## API contract review summary

### get-state / apply-command / finalize

- Single Edge function action router — **good for TT** (one deployment unit)
- Client already blocks direct RPC for apply/finalize — **trust boundary preserved**
- Idempotency keys required — **compatible with TT command_log pattern** (TT-5B design)

### Realtime

- Channel scoped by matchId — TT must provision same matchId per sub_match
- Reload on version gap — safe for flaky mobile referees

### Result outbox

- **Critical gap for TT:** outbox writes exist but no consumer updates `team_tournament_sub_matches`
- TT-5B must implement consumer with idempotency aligned to `team_tournament_command_log`

---

## Duplicate logic flag (for TT-5A)

Both stacks implement rally/side-out scoring:

| TT legacy | Referee V5 |
|-----------|------------|
| `team-tournament/engines/rallyScoringEngine.js` | `referee-v5/engines/rallyScoringEngine.js` |
| `teamRefereeEngine.js` orchestration | `matchStateEngine.js` + command dispatcher |

Handoff correctly positions V5 as **server-authoritative** replacement; TT-5A must produce deprecation plan for client-side `teamRefereeEngine` scoring path.

---

## Invalid prior audit

`docs/v5/team-tournament/TT5-A_*.md` — **not valid**. This handoff review supersedes those findings until TT-5A runs on integration branch.

---

## Recommendation

1. Owner commits Referee V5 working tree → `feature/referee-v5-platform` (proposed)
2. Re-run handoff review against committed SHA
3. Then start TT-5A on `feature/tt5-referee-v5-integration`
