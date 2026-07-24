# I&A-02 — Metric Registry and Definition Governance

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-02 |
| Slice | Metric Registry and Definition Governance |
| Module home | `src/features/intelligence-analytics/registry` |
| Baseline | fresh `origin/main` (extends merged I&A-01) |
| Platform Core | CLOSED — not modified |
| Competition E2E | not depended upon |
| SQL / migration / Supabase write | none |
| Dashboard / route changes | none |
| Production metric catalog | none (deferred) |

## Decision

I&A-01 provides metric definition contracts but no shared registry, lifecycle,
duplicate/conflict governance, or version compatibility classification.

No equivalent canonical registry existed on `origin/main`. Therefore I&A-02
adds an explicit in-memory registry governance layer under
`src/features/intelligence-analytics/registry/**`, composing I&A-01 validators
rather than duplicating them.

Legacy `dashboard-analytics` / `statistics` KPI hard-codes remain
**LEGACY_BUT_ACTIVE** inventory only — not migrated in I&A-02.

## Owned surface

- `registry/**` — lifecycle, deprecation, entry, validation, compatibility,
  immutable registry, read-only facade
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-02-metric-registry.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Compatibility rules (documented)

| Classification | Meaning |
| --- | --- |
| `identical` | All semantic fields and definition text match |
| `breaking` | Unit, aggregation, missing-data, metricKind, source core, tenant-scope removal, granularity removal, or dimension removal |
| `backward_compatible` | Only additive tenant scopes / granularities / dimensions; other semantics unchanged |
| `indeterminate` | Definition text or optional source.reference drift without breaking structural change; or metricId mismatch |

## Explicit non-goals

- Persisted / SQL / Supabase registry
- Runtime query adapters (I&A-03)
- Dashboard metric migration (I&A-04+)
- Module-specific production metric catalogs
- Historical store / alerts / AI

## Validation expectations

1. Valid metric definition registers successfully.
2. Invalid definition is rejected with a typed error.
3. Same ID/version + same definition is idempotent.
4. Same ID/version + different definition conflicts.
5. Multiple versions of the same metric ID coexist.
6. Exact lookup requires ID and version.
7. External input objects cannot mutate the registry.
8. Consumer clones cannot mutate registry internals.
9. Lifecycle filters are deterministic; ACTIVE and RETIRED are not mixed.
10. DEPRECATED keeps replacement metadata; self-reference is rejected.
11. Tenant applicability and provenance/source are preserved.
12. Compatibility classifies IDENTICAL / BREAKING / dimension add-remove deterministically.
13. Read-only facade rejects register/write commands.
14. Empty registry behavior is defined.
15. Module does not import database / Supabase / React / Platform Core / business modules.

## Progress baseline

Before merge I&A-02: `1/13` structural workstreams certified (≈ 7.7%).

After post-merge verification I&A-02: `2/13` (≈ 15.4%).

Next default workstream: I&A-03 Analytics Query and Projection Runtime.
