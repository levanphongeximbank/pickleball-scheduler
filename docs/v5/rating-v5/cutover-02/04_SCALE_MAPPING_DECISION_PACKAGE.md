# CUTOVER-02 — Scale Mapping Decision Package

```text
OWNER_APPROVAL_REQUIRED=YES
STATUS=UNAPPROVED
DEFAULT_STRATEGY=RAW_ONLY
```

## Conflict

| Authority | Scale |
|-----------|-------|
| V2 published | 1.0 – 8.0 |
| V5 shadow | 1.5 – 6.0 |

CUTOVER-02 compares **raw values** and records scale IDs. It does **not** declare numeric equivalence.

## Alternatives (proposal only — Owner chooses)

### 1) Linear conversion

- Formula: `v5 = 1.5 + (v2 - 1.0) * 4.5 / 7.0`
- Rounding: 0.1 display
- Boundary: clamp to destination
- Information loss: compresses 6.0–8.0 into ≤6.0
- Seeding / pairing: high impact at top band
- Migration / rollback: needs raw provenance; medium risk

### 2) Bounded piecewise

- Formula: map [1–4]→[1.5–4], [4–6]→[4–5.5], [6–8]→[5.5–6]
- Rounding: 0.1 per segment
- Loss: severe above 6.0
- Seeding: medium–high for advanced brackets
- Rollback: medium

### 3) Category / band

- Formula: band labels only (no numeric equivalence)
- Loss: full precision
- Seeding: cannot continuous-seed
- Safe for compare display; unsafe as published cutover

## Runtime

`resolveScaleMappingPolicy()` defaults to `UNAPPROVED` / `RAW_ONLY`.
`compareRawRatingPair()` returns `NO_EQUIVALENCE_MAPPING_UNAPPROVED` until Owner approves.
