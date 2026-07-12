# CC-04E — Seed Shadow Comparison

**Phase:** CC-04E | **Business output:** Legacy authoritative

## Purpose

Run CC-04B `runCanonicalSeedPipeline()` in **shadow mode** alongside legacy seed ordering. Mismatches are reported; legacy seed is never overridden.

## Helper

`compareSeedShadowParity({ participants, legacySeeds, seedRequest })`

## Comparison fields

| Field | Description |
|-------|-------------|
| `legacySeedNumber` | Legacy rank |
| `canonicalSeedNumber` | Canonical pipeline rank |
| `legacySeedScore` | Legacy score if available |
| `canonicalSeedScore` | Canonical computed score |
| `sourceDifference` | Source mismatch label |
| `rankingMismatch` | Rank differs |
| `tieBreakDifference` | Equal score, different rank |
| `confidence` | Canonical confidence |
| `warnings` | Row-level warnings |

## Legacy seed rows

`buildLegacySeedRowsFromOrder(sortedParticipants)` — shadow helper for team/tournament ordering tests.

## Limitation

Canonical pipeline uses reference formula only — ranking mismatches against production seed engines are expected and informational.
