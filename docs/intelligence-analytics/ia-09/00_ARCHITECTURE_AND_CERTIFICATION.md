# I&A-09 — Finance, Ranking and Performance Analytics

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-09 |
| Slice | Finance, Ranking and Performance Analytics |
| Module home | `src/features/intelligence-analytics/finance-ranking-performance-analytics` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-08) |
| Platform Core | CLOSED — not modified |
| Finance | consumed only via future explicit adapters; no finance imports in this slice |
| VPR Ranking | consumed only via future explicit adapters; no ranking imports in this slice |
| Player Rating | consumed only via future explicit adapters; no rating imports in this slice |
| Competition / Player | consumed only via future explicit adapters; no competition/player imports in this slice |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Ledger posting / revenue recognition | none |
| Currency conversion | none |
| Ranking / rating / standings / score / winner recalculation | none |
| Module-specific production adapters | none (deferred) |

## Decision

I&A-01..08 provide metric identity, registry governance, query/projection
runtime, presentation-neutral dashboard/report contracts, historical/trend
analysis, competition analytics, venue/court/club analytics, and
privacy-safe customer/player analytics. No canonical Finance / Ranking /
Performance Analytics source contract, currency-safe analytical money
contract, privacy-safe-and-payment-safe analytical fact envelope,
finance/ranking/performance metric catalog, finance/ranking/rating/
performance summary projections, or read-only Finance/Ranking/Performance
Analytics facade existed on `origin/main`.

Canonical operational boundaries remain:

- `src/features/finance` — ledger, invoicing, payment, settlement SoT
- `src/features/vpr-ranking` — ranking calculation SoT
- `src/features/player-rating` — rating calculation SoT
- `src/features/competition-*` / `src/features/player` — match/outcome SoT

Therefore I&A-09 adds a Finance / Ranking / Performance Analytics foundation
under `src/features/intelligence-analytics/finance-ranking-performance-analytics/**`,
composing I&A-01..08 contracts rather than duplicating them, and accepting
only **explicit privacy-safe, payment-safe, currency-safe analytical facts**
from a read-only source adapter.

## Owned surface

- `finance-ranking-performance-analytics/**` — context, privacy helpers,
  analytical money contract, facts, snapshot, guards, source adapter, metric
  catalog, query, projections (including compatible-system-only ranking
  movement), historical observation composition, dashboard/report payload
  composers, read-only facade, in-memory certification source
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-09-finance-ranking-performance-analytics.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
Finance / Ranking / Rating / Competition canonical facades, snapshots or events
                         │
                         ▼
   FinanceRankingPerformanceAnalyticsSourceAdapter
                         │
                         ▼
  Privacy-Safe, Currency-Safe Explicit Analytical Facts
                         │
                         ▼
 Tenant / Currency / RankingSystem / RatingSystem / Player / Team / Competition
                         Guard → Validation
                         │
                         ▼
 Finance / Ranking (+ Movement) / Rating / Performance Projections
                         │
                         ▼
 Historical Series + Dashboard/Report Payloads
                         │
                         ▼
      FinanceRankingPerformanceAnalyticsResult
```

## Privacy and payment boundaries

Forbidden in analytical facts (non-exhaustive): full name, email, phone,
street address, full date of birth, government identifier, auth tokens,
generic payment/bank details, private notes, free-text profile, health/
biometric data, credentials, bank account number, card number/token, payment
token/credential, CVV/CVC, invoice/private notes, account/routing number,
IBAN, PAN.

Allowed: opaque tenant/entity/system/competition IDs, explicit status/
outcome/validation labels, explicit integer minor-unit monetary amounts with
an explicit ISO-style currency code, explicit boolean settlement/overdue/
completion signals, explicit ISO timestamps, canonical source references.

## Monetary boundaries

- Amounts are always integer minor units (`Number.isInteger` and
  `Number.isFinite`); floating-point amounts are rejected.
- No currency conversion is ever performed.
- Scalar sums across mixed currencies fail closed with
  `FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH`; summaries may instead
  expose a per-currency `amountsByCurrency` map.
- Revenue/expense recognition is accepted only from explicit
  `FinanceRecognizedAmountFact` records with an explicit `RECOGNIZED` status
  or `recognized === true` — booking/payment facts are never substituted as
  revenue.
- Receivable `overdue` is accepted only from an explicit boolean or an
  explicit `OVERDUE` status — never inferred from due dates.

## Ranking / rating / performance boundaries

- Ranking movement comparisons require the compared ranking snapshots to
  share the same `rankingSystemId`, `rankingSystemVersion`, `entityType`
  (when present), and `rankDirection` metadata; incompatible comparisons
  fail closed.
- "Up"/"down" movement always reports the raw numeric rank change;
  `rankDirectionInterpretedAsBetter` is only `true` when the source snapshot
  explicitly states an `ASCENDING_BETTER` / `DESCENDING_BETTER` direction.
- Rating changes are read from explicit `delta` (or explicit
  `beforeValue`/`afterValue`) fields only — the rating algorithm itself is
  never recalculated.
- Performance outcomes are counted as validated wins/losses/draws only when
  `validationStatus` is explicitly `accepted`; `rejected`/`pending`/`void`
  outcomes are excluded. `unknown` outcomes are never coerced to `loss`.
  Winner is never inferred from a raw score — `scorePresent` is a flag only.

## Explicit non-goals

- Finance ledger posting / revenue or expense recognition decisions
- Currency conversion
- Ranking / rating / standings / score / winner calculation or recalculation
- Treating booking or payment facts as revenue
- Inferring receivable overdue status from due dates
- Inferring match winner from raw score
- Production Finance / Ranking / Rating / Competition source adapters (deferred)
- Persisted analytics warehouse / ETL
- Dashboard UI migration / Experience Channel wiring
- Forecasting / AI metrics
- Platform Core / Finance / VPR Ranking / Player Rating / Competition / Player source changes
- SQL / Supabase / localStorage access
- Package / lockfile changes

## Validation expectations

1. Valid analytics context; missing tenant rejected.
2. Tenant isolation fails closed on mixed-tenant facts (no silent filter).
3. `AnalyticalMoney` preserves currency/amount/scale; malformed money (float,
   NaN, Infinity, non-integer) rejected.
4. Mixed-currency scalar sums fail closed with `CURRENCY_MISMATCH`;
   per-currency summaries remain available.
5. Finance projections (transaction/invoice/payment/refund/settlement/
   receivable/recognized-amount) are correct and deterministic.
6. Booking/payment facts are never counted as recognized revenue.
7. Ranking movement comparisons require compatible ranking system/version/
   entity type/direction; incompatible comparisons fail closed.
8. Rating changes are never recalculated; delta/before/after preserved as-is.
9. Performance outcomes are counted from accepted `validationStatus` only;
   `unknown` never becomes `loss`; `rejected` never becomes validated.
10. Historical observations preserve currency / ranking-system / rating-
    system / entity dimensions; composed via I&A-05.
11. Dashboard payloads are I&A-04 compatible.
12. Read-only facade; write/command operations rejected; no global singleton.
13. No React / Supabase / Platform Core / private business-module imports.
14. I&A-01..08 markers remain exported alongside new I&A-09 markers.
15. Capability flags (`ledgerPosted`, `revenueRecognizedByAnalytics`,
    `currencyConverted`, `rankingCalculated`, `ratingCalculated`,
    `standingsCalculated`, `scoreRecalculated`, `winnerInferredFromScore`,
    `performanceScoreInvented`) are always `false`.
16. PII / payment-credential fields rejected at fact creation; errors do not
    echo PII/payment values.
17. Results set `isCanonicalFinanceState` / `isCanonicalRankingState` /
    `isCanonicalRatingState` / `isCanonicalPerformanceState` /
    `isCanonicalModuleState` to `false`.
