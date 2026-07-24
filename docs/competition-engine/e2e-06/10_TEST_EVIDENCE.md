# E2E-06 — Test Evidence

## Targeted suite

`tests/competition-engine-e2e-06-governance-reliability.test.js`

Registered in `scripts/ci/unit-test-files.json`.

**Result:** **13/13 PASS**

### Coverage groups

1. Facade authz — valid / missing tenant / missing competition / missing identity / permission denied / client grants / cross-tenant / deterministic / immutable
2. Reliability policy — READY / DEGRADED / BLOCKED / SUSPENDED / RECOVERING / typed issue codes
3. Audit evidence — deterministic manifest / secrets excluded / no persistence side effect
4. Replay — seed required / same plan / reorder stable / lineage conflict / no engine duplication
5. Import/export — checksum / schema / duplicate / dry-run / private fields / cross-tenant / deterministic export fingerprint
6. Recovery — checkpoint / authority / conflict / no mutation / no direct match resume
7. Archive/completion — ACTIVE blocked / COMPLETED ready / CANCELLED path / no delete-purge
8. Presentation sections (15)
9. Certification readiness projection (no production claim)
10. Architecture scan — no Supabase / Date.now / Math.random / cross-owned imports
11. Incident projection — not platform incident owner

## Adjacent regression

| Suite | Result |
|-------|--------|
| E2E-03 + E2E-04 + E2E-05 + E2E-06 + CM-06/07/08 + CORE-19/21/22/23 | **411/411 PASS** |
| E2E-01 + CORE-20 | **39/39 PASS** |
| Combined related | **450/450 PASS** |

## Gates

| Gate | Result |
|------|--------|
| ESLint owned/shared paths | PASS |
| `npm run ci:foundation-lock` | PASS |
| `npm run build` | PASS |
| `package.json` / `package-lock.json` | UNCHANGED |
