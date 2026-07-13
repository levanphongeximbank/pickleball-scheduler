# CC-10 Stage 1 — Performance

From `CC10_STAGE1_SHADOW_MATRIX_REPORT.json` (local harness, ms):

| Module | Legacy-ish duration | Shadow total | Overhead | User impact |
|---|---|---|---|---|
| draw | 0.3–6.3 | same window | negligible | none |
| formation | 1–4 | same | negligible | none |
| matchmaking | 2–15 | same | low | none |
| rules | 0.1–2 | same | negligible | none |
| standings | 0.2–1 | same | negligible | none |
| scheduling | 0.2–3.4 | same | negligible | none |

CC-05C formation performance tests stabilized: non-pathological overhead bound (<30s) separated from correctness assertions.

**P0 issues:** none observed.
