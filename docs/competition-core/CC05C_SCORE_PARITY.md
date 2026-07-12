# CC-05C Score Parity

## Rule

Legacy score remains authoritative. Canonical score is reference-only shadow.

## Scale handling

- Normalize 0–1 → 0–100
- If scales incompatible → `SCORE_SCALE_NOT_COMPARABLE:scale_incompatible`
- Large delta (>50 normalized) → `SCORE_SCALE_NOT_COMPARABLE:large_delta`
- Does not fail parity when scales not comparable (`ok: true`, `comparable: false`)

## Fields

legacyFinalScore, canonicalFinalScore, component differences, weightVersion `cc05a-v1`

## Source

`formationScoreParity.js`
