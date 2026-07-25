# I&A-10 — Operational Alerts and Insights

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-10 |
| Slice | Operational Alerts and Insights |
| Module home | `src/features/intelligence-analytics/operational-alerts-insights` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-09) |
| Platform Core | CLOSED — not modified |
| Notification | consumed only via future explicit adapters; no notification delivery in this slice |
| Finance / VPR Ranking / Player Rating / Competition / Player / Customer | consumed only via merged I&A-06..09 metric identities; no private business-module imports |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Alert acknowledgement / resolution persistence | none (projection only) |
| Notification delivery | none (transport-neutral candidate only) |
| Remediation / auto-fix / AI | none |
| Module-specific production signal adapters | none (deferred) |

## Decision

I&A-01..09 provide metric identity, registry governance, query/projection
runtime, presentation-neutral dashboard/report contracts, historical/trend
analysis, competition/venue-court-club/customer-player/finance-ranking-
performance analytics. No canonical Operational Signal contract, alert/
insight rule definition contract, deterministic threshold/state/trend/
missing-data/freshness evaluators, deduplication/correlation/cooldown/
suppression/resolution policy contracts, alert/insight lifecycle
projection, or read-only Operational Alerts and Insights facade existed on
`origin/main`.

Canonical operational boundaries remain:

- `src/features/notification` — notification delivery SoT (channel, provider, retry, delivery status)
- `src/features/finance`, `src/features/vpr-ranking`, `src/features/player-rating`, `src/features/competition-*`, `src/features/player`, `src/features/customer` — domain calculation / record-of-truth SoT

Therefore I&A-10 adds an Operational Alerts and Insights foundation under
`src/features/intelligence-analytics/operational-alerts-insights/**`,
composing I&A-01..09 merged metric identities rather than duplicating them,
and accepting only **explicit, privacy-safe, transport-neutral operational
signals** from a read-only source adapter. Alerts and insights are
deterministic analytical projections — never a notification delivery
pipeline, never a rules/remediation engine, and never a recalculation of
the domain metrics they observe.

## Owned surface

- `operational-alerts-insights/**` — enums, privacy helpers, evaluation
  context, operational signal + snapshot contracts, tenant/entity/currency
  isolation guards, source adapter + in-memory certification source,
  dedup/cooldown/suppression/resolution policy contracts, threshold/state/
  trend/missing-data/freshness condition contracts, deterministic
  evaluators, deduplication/correlation key generation, foundation rule
  catalog (bound to stable I&A-06..09 metric IDs), alert/insight/evidence/
  notification-candidate result builders, deterministic evaluation
  orchestration, dashboard payload composer, read-only facade
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-10-operational-alerts-insights.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
Venue/Court/Club, Competition, Customer/Player, Finance/Ranking/Performance
canonical facades, snapshots or events
                         │
                         ▼
      OperationalSignalSourceAdapter (explicit, privacy-safe)
                         │
                         ▼
           OperationalSignalsSnapshot (tenant-scoped)
                         │
                         ▼
     Tenant / Entity / Currency / RankingSystem Guard → Validation
                         │
                         ▼
   Foundation Rule Catalog (threshold / state / trend / missing-data /
        freshness / source-failure conditions bound to stable metric IDs)
                         │
                         ▼
   Deterministic Evaluators → Dedup/Correlation Keys → Cooldown/
        Suppression/Acknowledgement/Resolution/Expiration Lifecycle
                         │
                         ▼
        OperationalAlert / OperationalInsight (evidence-backed,
                  explanation without invented causality)
                         │
                         ▼
   Dashboard/Report Payloads (I&A-04) + Notification Candidates
        (transport-neutral, undelivered)
```

## Privacy and delivery boundaries

Forbidden on operational signals, contexts, rules, alerts, insights, and
notification candidates (non-exhaustive): email, phone/mobile, device/push
token, recipient/recipient list, delivery channel/provider, password/
secret/API key/credentials, card number/CVV/PAN, SSN/national ID, full
name/first/last name, address, private message/message body, retry count,
delivery state/status.

Allowed: opaque tenant/entity/metric/signal/rule IDs, explicit numeric/
percentage/money/state/boolean/trend values, explicit ISO timestamps,
explicit freshness/completeness enums, canonical source references,
transport-neutral notification metadata (alertId, severity, title,
summary, dedup key, safe payload metadata) with no recipient or channel.

## Evaluation boundaries

- Missing signals are **never** filled as zero (`neverFillZero`,
  `filledAsZero: false` always on missing-data evaluation results); the
  per-rule `missingDataPolicy` (`ALERT` / `WARN` / `SKIP` / `FAIL`)
  determines the deterministic outcome.
- Stale signals are **never** treated as fresh (`treatedAsFresh: false`
  always on freshness evaluation results); the per-rule `staleDataPolicy`
  (`ALERT` / `WARN` / `SKIP` / `FAIL`) determines the deterministic
  outcome.
- Threshold evaluation fails closed on unit mismatch
  (`OPERATIONAL_ALERTS_UNIT_MISMATCH`), cross-currency comparison
  (`OPERATIONAL_ALERTS_CURRENCY_MISMATCH`), and non-finite/out-of-range
  percentage values (`OPERATIONAL_ALERTS_THRESHOLD_INVALID`).
- A signal whose `metricId` matches a rule but whose `metricVersion`
  differs fails the whole evaluation closed
  (`OPERATIONAL_ALERTS_METRIC_VERSION_MISMATCH`) rather than silently
  evaluating against a mismatched metric contract.
- Deduplication and correlation keys are pure functions of tenant, rule,
  metric, entity scope, and (optionally) time bucket / condition identity
  — never random, never solely time-based.
- Alert lifecycle (`OPEN` / `ACKNOWLEDGED` / `RESOLVED` / `EXPIRED` /
  `SUPPRESSED`) is a read-only **projection**: `ACKNOWLEDGED` only comes
  from explicit consumer-supplied acknowledgements keyed by dedup key;
  `RESOLVED` only from an explicit `resolutionPolicy.resolveWhenConditionClears`
  plus an explicitly cleared condition; `EXPIRED` only from an explicit
  `resolutionPolicy.expireAfterMs` elapsed since the signal was observed;
  `SUPPRESSED` only from an explicit cooldown match against caller-supplied
  prior alerts. Nothing is ever auto-acknowledged, auto-resolved, or
  persisted by this module.
- Insight explanations are rejected if they claim causality (matching the
  word "because") — insights report observations, not inferred causes.
- Notification candidates are transport-neutral and always
  `isDeliveredNotification: false` / `deliveryCoupled: false` — this
  module never delivers, retries, or tracks delivery status.

## Explicit non-goals

- Notification delivery (email/SMS/push/webhook) or delivery-status tracking
- Recalculating availability, progress, churn, accounting, ranking, rating,
  or score — signals are consumed exactly as provided by upstream I&A
  projections
- Persisting acknowledgement, resolution, or suppression decisions
- Remediation, auto-fix, or AI-generated recommendations
- Production signal adapters for Venue/Court/Club, Competition, Customer/
  Player, or Finance/Ranking/Performance sources (deferred)
- Persisted alert/insight warehouse / ETL
- Dashboard UI migration / Experience Channel wiring
- Platform Core / Notification / Finance / VPR Ranking / Player Rating /
  Competition / Player / Customer source changes
- SQL / Supabase / localStorage access
- Package / lockfile changes

## Validation expectations

1. Valid evaluation context; missing tenant rejected.
2. Tenant / entity / currency isolation fails closed (no silent filtering).
3. Signal `metricId` present with a mismatched `metricVersion` against a
   rule fails the whole evaluation closed.
4. Threshold operators (`gt`/`gte`/`lt`/`lte`/`eq`/`neq`/`inside_range`/
   `outside_range`) are evaluated deterministically; inclusive operators
   include the boundary, strict operators exclude it.
5. Percentage values/thresholds outside `[0, 1]` and non-finite
   values/thresholds are rejected at construction time.
6. Missing-signal and stale-signal policies (`ALERT` / `WARN` / `SKIP` /
   `FAIL`) are deterministic and never silently drop a required signal.
7. State conditions (`equals` / `inSet` / `notInSet`) and trend conditions
   (direction, minimum periods, minimum coverage, significance threshold)
   evaluate deterministically; insufficient periods/coverage skip with a
   warning rather than alerting on insufficient data.
8. Alert lifecycle projection (`OPEN` / `ACKNOWLEDGED` / `RESOLVED` /
   `EXPIRED` / `SUPPRESSED`) only changes from explicit policy + explicit
   input (acknowledgements, prior alerts, resolution/expiration policy) —
   never automatically inferred.
9. Deduplication and correlation keys are deterministic, pure functions of
   their inputs; different tenant/entity/rule-version inputs always
   produce different keys.
10. Alert/insight evidence and explanation are rendered from observed
    values only; insight explanations never claim causality.
11. Provenance / freshness / completeness are preserved end-to-end from the
    source signal onto the alert/insight; incomplete or stale data is never
    presented as complete or fresh.
12. Domain-scoped rules bind only to stable, already-merged I&A-06..09
    metric IDs; this module never recalculates the underlying metric.
13. Notification candidates never carry recipient/channel/delivery fields
    and are always `isDeliveredNotification: false`.
14. Read-only facade; write/command/delivery operations rejected; no global
    singleton.
15. No React / MUI / Supabase / Platform Core / Notification / private
    business-module imports; no `localStorage` access.
16. I&A-01..09 markers remain exported alongside the new I&A-10 marker.
17. PII / sensitive fields are rejected at fact/context/rule/result
    creation; errors do not echo PII values.
18. Results set `isCanonicalDomainState` / `isDeliveredNotification` to
    `false` throughout.
