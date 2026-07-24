# E2E-06 — Replay / Import / Export Governance

## Replay (GOV-03 → CORE-21)

Gates:

- explicit seed required
- supported event range / canonical ordering (`sortStableIds`)
- source fingerprint
- replay target
- conflict / missing lineage → blocked
- input immutability + output determinism flags
- **no** new replay engine (`ownsReplayEngine: false`)

Proofs in tests:

- same inputs → same `planFingerprint`
- reordered equivalent events → same canonical order + fingerprint
- missing seed → fail-closed readiness
- lineage conflict → blocked

## Import (GOV-05 → CORE-22)

Requires: tenant/competition scope, checksum, schema/version compatibility, duplicate-identity detection, conflict strategy, dry-run default, authority, audit intent, rollback requirement.

Rejects cross-tenant packages.

## Export (GOV-05 → CORE-22)

Requires: visibility scope, private-field exclusion, deterministic fingerprint/checksum, source revision, publication/archive state awareness, actor authority.

No file upload/download backend (`ownsFileBackend: false`).
