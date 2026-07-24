# E2E-06 → E2E-07 Readiness

## Ready for E2E-07 consumers

- `createCompetitionGovernanceReliabilityFacade` public surface
- Runtime health + degraded-mode projections
- Reliability evidence manifest + CORE-20 handoff shape
- Replay / import / export / recovery readiness gates
- Archive/completion readiness without mutation
- Permission/tenant fail-closed matrix
- `buildGovernanceReliabilitySections` presentation adapter
- Certification readiness projection (`createCertificationReadinessProjection`)

## E2E-07 must still own

- GOV-08 Benchmark & Diagnostics
- Full IND Pool+Knockout vertical certification pack
- Collision re-check vs fresh `origin/main`
- Staging/Production remote evidence (if Owner requires)
- Final Owner certification marker `E2E_07_CERTIFICATION_COMPLETE`

## Explicitly not certified by E2E-06

- Production runtime wiring
- Platform incident product completeness
- Full APM
- Formal protest adjudication (OPS-12)
- Incident workflow product (OPS-11)

## Contract freeze recommendation

After E2E-06 merge, treat governance facade method names, error codes (`E2E06_*`), health states, and evidence manifest fields as frozen for E2E-07 certification tests.
