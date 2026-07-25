# I&A-13 — Integration Hardening and Final Certification

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-13 |
| Slice | Integration Hardening and Final Certification |
| Module home | `src/features/intelligence-analytics/integration-hardening-final-certification` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-12) |
| Platform Core | CLOSED — not modified; not imported privately |
| Business modules | CLOSED — not modified |
| SQL / migration / Supabase | none |
| Dashboard UI / route changes | none |
| Production analytics adapters | none (deferred) |
| Provider SDK / network calls | none |
| API keys / secrets / env vars | none |
| Notification delivery | none |
| Package / lockfile changes | none |

## Decision

I&A-01..12 provide certified analytical contracts, domain projections,
privacy/access enforcement, operational insights, and AI readiness. No unified
final certification manifest, surface registry, cross-surface verifier suite,
deterministic closure report, or read-only final certification facade existed
on `origin/main`.

I&A-13 certifies the Intelligence & Analytics stack as one integrated
structural foundation. It does not add business analytics features and does
not claim Production readiness beyond foundation certification.

## Owned surface

- `integration-hardening-final-certification/**` — manifest, certified surfaces,
  dimensions, scenarios/evidence/results/final report, verifiers, deterministic
  runner, closure-readiness evaluator, in-memory certification-only source,
  read-only facade
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests:
  `tests/intelligence-analytics-ia-13-integration-hardening-final-certification.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
I&A-01..12 Public Surfaces
             │
             ▼
Final Analytics Surface Registry
             │
             ▼
Contract / Metric / Error / Export Validation
             │
             ▼
Tenant / Entity / Privacy / Currency / Version Invariants
             │
             ▼
Read-Only / No-Write / No-Private-Import Certification
             │
             ▼
Cross-Surface Integration Scenarios
             │
             ▼
Deterministic Final Certification Report
             │
             ▼
ReadOnlyIntelligenceAnalyticsFinalCertificationFacade
```

## Certification guarantees

- Deterministic public-surface and contract verification
- Metric and error registry integrity
- Fail-closed tenant/entity isolation
- Privacy/access state integrity (DENY≠EMPTY, SUPPRESS≠ZERO, REDACT≠MISSING, OMIT≠REDACT)
- Currency and ranking/rating compatibility
- Operational alert evidence safety
- AI advisory, non-canonical and no-write boundaries
- Mock and source-state honesty
- Reproducible final certification report (timestamp excluded from structural fingerprint)

## Deferred (Production integrations)

- Production analytics source adapters
- Persistence, ETL and warehouse integration
- Production privacy-policy adapters and database RLS certification
- Operational background evaluators and notification delivery
- Production AI providers, model hosting, embeddings and RAG
- Dashboard and Experience Channel UI adoption
- Operational monitoring

These deferred items do not block structural foundation closure when roadmap
scope is foundation certification only.
