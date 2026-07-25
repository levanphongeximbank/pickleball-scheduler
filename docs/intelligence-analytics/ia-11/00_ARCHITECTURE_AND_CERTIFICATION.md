# I&A-11 — Privacy, Tenant Isolation and Access Certification

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-11 |
| Slice | Privacy, Tenant Isolation and Access Certification |
| Module home | `src/features/intelligence-analytics/privacy-access-certification` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-10) |
| Platform Core | CLOSED — not modified; not imported privately |
| Business modules | CLOSED — access rules not modified |
| SQL / migration / Supabase / RLS apply | none |
| Dashboard UI / route changes | none |
| Production policy adapter | none (in-memory certification source only) |
| Auth / RBAC / membership mutation | none |
| Notification delivery | none |

## Decision

I&A-01..10 provide analytics contracts, metric registry, query/projection
runtime, dashboard/report contracts, historical/trend analysis, domain
analytics slices, and operational alerts/insights. No cross-cutting privacy
access-context certification, data-classification resolver, allow/deny/
redact/omit/suppress decision contract, small-cohort suppression foundation,
or privacy-safe historical/dashboard/alert projectors existed as a shared
I&A-11 certification surface on `origin/main`.

Canonical authorization remains owned by Platform Core. Domain visibility
rules remain owned by business modules. I&A-11 consumes an **explicit trusted
access context** and certifies privacy-safe analytical behavior without
replacing those owners.

## Owned surface

- `privacy-access-certification/**` — classification, trusted access context,
  privacy policy, access decisions, tenant/entity guards, metric/dimension
  evaluators, small-cohort suppression, redaction/omission, error sanitizer,
  historical/dashboard/alert projectors, certification evidence/report,
  in-memory policy source, read-only facade
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-11-privacy-tenant-isolation-access-certification.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
Trusted Platform/Module Access Context
                  │
                  ▼
       AnalyticsPrivacyAccessContext
                  │
                  ▼
 Metric / Dimension / Entity Privacy Classification
                  │
                  ▼
 Tenant Guard → Entity Guard → Access Policy Evaluation
                  │
                  ▼
 Allow / Deny / Redact / Suppress / Omit
                  │
                  ▼
 Privacy-Safe Analytics Result or Typed Failure
                  │
                  ▼
 Certification Evidence and Report
```

## Privacy boundaries

- Fail closed on missing tenant or missing trusted-source marker
- No arbitrary default tenant; no first-entity fallback
- Cross-tenant / cross-entity contamination → typed error (never silent filter)
- DENY ≠ EMPTY; SUPPRESS ≠ ZERO; REDACT ≠ MISSING; OMIT ≠ REDACT
- Errors/evidence never contain PII, payment credentials, raw facts, or tokens
- Small-cohort suppression is explicit, versioned, deterministic
- Analytics output sets `isCanonicalAuthorizationState: false`

## Deferred

- Production policy source adapters
- Database RLS certification
- Consent, retention and deletion implementation
- Persisted certification evidence
- UI-level access presentation
- Forecasting and AI (I&A-12)
