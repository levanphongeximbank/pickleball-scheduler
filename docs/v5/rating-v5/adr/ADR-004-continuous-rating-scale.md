# ADR-004 — Continuous rating scale

**Status:** Accepted (V5-A)  
**Date:** 2026-07-12

## Context

V2 uses score bands, ×0.6 calibration, and dual snap steps (0.1 ≤4.0, 0.5 above).

## Decision

- Internal: `rating_mean numeric(5,3)`, `rating_deviation numeric(5,3)`.
- Public range: 1.5–6.0.
- Display: `Math.round(mean * 10) / 10` only at presentation.
- No per-question, per-domain, or per-event rounding.

## Consequences

- `pickVnRatingScale.js` remains for legacy only.
- Questionnaire targets pilot MAE ≤ 0.25 (not claimed until pilot data).
