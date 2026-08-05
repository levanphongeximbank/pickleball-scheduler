# CUTOVER-02 — Reader / Consumer Matrix

Source of truth in code: `src/features/player-rating/cutover-02/dual-read/consumerMatrix.js`

| Consumer | Current source | Published-facing | Compare eligible | Sidecar-only | Failure behavior | Regression |
|----------|----------------|------------------|------------------|--------------|------------------|------------|
| getPlayerCurrentRating | V2 helpers | Yes | Yes | Yes | fail-open V2 | OFF/ON still V2 |
| player profile | V2 local+blob | Yes | Yes | Yes | UI keeps V2 | profile unchanged |
| public profile | stripped | No | No | Yes | n/a | no skill leak |
| roster | blob | Yes | Yes | Yes | keep blob V2 | card still V2 |
| pairing | V2-first | Internal | Yes | Yes | continue V2 | authority unchanged |
| player selector | V2 rows | Internal | Yes | Yes | keep V2 | adapter precedence |
| tournament seeding | snapshot/elo/skill | Internal | Yes | Yes | no published flip | seed order stable |
| club membership | V2→blob stamp | Yes | Yes | Yes | stamp V2 | hydrate V2 |
| rankings / VPR | VPR domain | No | No | Yes | out of scope | VPR untouched |
| season leaderboard | blob | Yes | Yes | Yes | export blob | CSV unchanged |
| exports | blob skill | Yes | Yes | Yes | export V2 | values unchanged |
| mobile/PWA | shared pages | Yes | Yes | Yes | same as shared | no V5 prefer |

**Rule:** No consumer is switched to V5 published read in CUTOVER-02.
