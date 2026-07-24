# E2E-07 — Evidence Manifest

Deterministic evidence JSON under `evidence/` (generated from harness builders):

| File | Builder |
|------|---------|
| structural-certification.json | `buildStructuralCertificationEvidence` |
| happy-path-certification.json | `buildHappyPathCertificationEvidence` |
| fail-closed-certification.json | `buildFailClosedCertificationEvidence` |
| recovery-replay-certification.json | `buildRecoveryReplayCertificationEvidence` |
| public-privacy-certification.json | `buildPublicPrivacyCertificationEvidence` |
| governance-certification.json | `buildGovernanceCertificationEvidence` |
| performance-certification.json | `buildPerformanceCertificationEvidence` |
| deferred-remote-certification.json | `buildDeferredRemoteCertificationEvidence` |
| final-certification-manifest.json | `buildFinalCertificationManifest` |

Common fields: `generatedAt: null`, `sourceCommit: "TBD"`, `fingerprint`, `verdict`, `deferredChecks`.

Full-pack fingerprint example: `e2e07:f7c53991050bfd4650ccfabd8ad7e91c` (local deterministic pack; re-verify after commit via harness).

Additional classification evidence: `evidence/core08-gate-classification.json` (`PRE_EXISTING_MAIN_FAILURE` / `BRANCH_LOCAL_DELTA_POLICY`).

No secrets in evidence payloads.
