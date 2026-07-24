# I&A-01 — Canonical Analytics Contracts Foundation

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-01 |
| Slice | Canonical Analytics Contracts Foundation |
| Module home | `src/features/intelligence-analytics` |
| Baseline | fresh `origin/main` |
| Platform Core | CLOSED — not modified |
| Competition E2E | not depended upon |
| SQL / migration / Supabase write | none |
| Dashboard / route changes | none |

## Decision

Existing `dashboard-analytics` and `statistics` modules are **legacy active UI
consumers** (localStorage / mock / domain booking helpers). They do **not**
provide versioned metric definitions, immutable query descriptors, provenance
on results, or fail-closed tenant-scoped query contracts.

Therefore I&A-01 introduces a new module-neutral foundation under
`src/features/intelligence-analytics/**` instead of extending dashboard UI code.

## Owned surface

- `contracts/**` — metric, query, result, tenant, time, provenance
- `projections/**` — module-neutral data-point / series projection
- `aggregation/**` — deterministic aggregation on explicit input
- `facade/**` — read-only facade factory
- `index.js` + `ARCHITECTURE.md`
- Targeted tests + this certification document

## Explicit non-goals

- Runtime adapters for Competition / Finance / Venue / Customer / Player
- Metric registry governance (I&A-02)
- Query execution runtime (I&A-03)
- Dashboard wiring (I&A-04+)
- AI / alerts / historical persistence

## Validation expectations

1. Metric ID and version are mandatory.
2. Tenant-scoped queries without tenant context fail closed.
3. Query descriptors are immutable / frozen.
4. Results preserve provenance and set `isCanonicalModuleState: false`.
5. Identical explicit inputs yield identical aggregation output.
6. Empty and invalid numeric inputs have defined typed behavior.
7. Missing data is not coerced to zero unless `COALESCE_ZERO` is selected.
8. Unsupported aggregation returns a typed error.
9. Read-only facade rejects write/command surface.
10. Module does not import database / Supabase / React / Platform Core.

## Progress baseline

Before merge: `0/13` structural workstreams certified.

After post-merge verification: `1/13` (≈ 7.7%).
