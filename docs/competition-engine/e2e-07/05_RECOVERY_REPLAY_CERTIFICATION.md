# E2E-07 — Recovery & Replay Certification

Uses `createCompetitionGovernanceReliabilityFacade`:

- `evaluateReplayReadiness` — deterministic fingerprint on repeat; missing seed → `GOV_REPLAY_SEED_MISSING`
- `evaluateRecoveryReadiness` — checkpoint present path; missing checkpoint → `GOV_RECOVERY_CHECKPOINT_MISSING`

Governance record includes paused workflow fixture support and deterministic replay seed from scenario fixture.

Implementation: `runRecoveryReplayCertification.js`
