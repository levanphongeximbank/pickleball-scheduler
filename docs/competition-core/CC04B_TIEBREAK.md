# CC-04B — Seed Tie-Break Model

Contract order (`DEFAULT_SEED_TIEBREAK_ORDER`):

1. Manual seed (`manual_seed`)
2. Higher Elo (`higher_elo`)
3. Higher win rate (`higher_win_rate`)
4. Higher performance (`higher_performance`)
5. Registration time (`registration_time`)
6. Deterministic random seed (`random_seed`)

Helpers: `applySeedTieBreakKind`, `compareParticipantsWithTieBreak`, `sortParticipantsForSeedRank`.

No runtime wiring in CC-04B.
