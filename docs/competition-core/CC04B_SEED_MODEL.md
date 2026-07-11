# CC-04B — Seed Score Model

Reference model in `seedScoreModel.js` — **does not replace runtime formulas**.

## Components

| Field | Purpose |
|-------|---------|
| baseScore | Weighted metric blend |
| competitionEloComponent | Elo contribution |
| averageLevelComponent | Public skill / level |
| internalRatingComponent | `ratingInternal` path |
| winRateComponent | Win rate |
| performanceComponent | Recent performance |
| manualAdjustment | Priority bump |
| provisionalPenalty | Provisional player penalty |
| newPlayerPenalty | New/unseeded player penalty |
| manualOverrideScore | Fixed score when manual override (`9999 - seedNumber`) |
| total | Final reference score |

## Weights

`DEFAULT_SEED_SCORE_WEIGHTS` — contract defaults only.

## Source resolution

`resolveReferenceRatingSource()` maps participant metrics → `CANONICAL_SEED_SOURCE`.

## Confidence

`estimateReferenceSeedConfidence()` — 0–1 based on metric coverage.
