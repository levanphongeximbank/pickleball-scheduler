# team-tournament-owner-browser-acceptance-remediation-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**Forward-only after `team-tournament-post-lineup-complete-lifecycle-01`.**
**NEVER re-run lifecycle `02_APPLY.sql`.** Lifecycle APPLY already landed once on Staging; this package is the corrected follow-up.

## Why (R1–R4 follow-up)

Owner browser acceptance after PR #418 / lifecycle-01 left four closure gaps. This SQL package closes the server-side pieces; client remediations live in the app worktree.

| ID | Gap | This package |
|----|-----|--------------|
| **R1** | Referee portal must not call `club_list_members` / `profiles.player_id` for athlete identity | New `team_tournament_referee_competition_athlete_directory` — competition-scoped members → athletes → profiles |
| **R2** | Per-stage `scoringMode` (`rally` \| `traditional`) rejected by setup-config whitelist | Extend `team_tournament_update_setup_config` stage scoring fields + normalize into `v_entry_norm` |
| **R3** | Close readiness must remain fail-closed (one-group / multi-group matrix) | Disposable VERIFY matrix (corrected FK/name/tenant) — does not reinstall close/readiness bodies |
| **R4** | Lifecycle `03_VERIFY` disposable insert used fake tenant and omitted required `name` | Corrected VERIFY only; **do not** re-apply lifecycle `02_APPLY` |

## Architecture locks

- Coarse `matchup.stage` remains `group|knockout` (#416).
- Lifecycle close/readiness/search RPCs stay as applied by lifecycle-01.
- Directory: **NO** `club_list_members`, **NO** `profiles.player_id`.
- Scoring mode canonical storage: `scoringMode` ∈ `{rally, traditional}`; `scoringSystem` / `side_out` / `direct` accepted as aliases only.
- STAGING_MUTATIONS=0 until Owner GO.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql` (disposable rows; must clean to zero)
4. Keep `04_ROLLBACK.sql` for emergency only

## Explicit non-goals

- Do **not** re-run `team-tournament-post-lineup-complete-lifecycle-01/02_APPLY.sql`
- Do **not** drop/replace `assert_close_readiness` or `close_tournament`
- Do **not** apply to Production

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `43b37e1fc65ef175ac194f27eb3aaa773fbd361fee0122b46cffab82e0797f10` |
| `02_APPLY.sql` | `a0a405526ea19229e4a89cd65b592f341a7e9514bbe0c4ee1ff226be0dd2756e` |
| `03_VERIFY.sql` | `4b10a680f7896447730e984665f4fcc34a0b90a27d0047e797190cd718f936c1` |
| `04_ROLLBACK.sql` | `b696f6c9910cba48cb5198d15238cdfedcdc6b83ebd249351fc252d8a9c2cfcb` |

## Safety

- Owner GO required
- PRODUCTION_MUTATIONS=0
- See `EVIDENCE.md` for lifecycle apply-once note
