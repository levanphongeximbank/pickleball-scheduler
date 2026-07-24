# E2E-06 — Audit & Evidence Model (GOV-02)

## Manifest fields

- competition identity / tenant identity
- operation/action
- actor (id + role only)
- source / workflow / lifecycle / publication / result-validation revisions
- standings fingerprint
- replay seed (value used for readiness; presence flagged in audit payload)
- recovery checkpoint fingerprint
- export checksum when present
- decision result
- issues
- deterministic fingerprint

## CORE-20 handoff

`buildAuditEvidenceHandoff` uses:

- `createActorReference` / `createSubjectReference` / `createCompetitionScope` / `createAuditSource`
- `sanitizeAuditPayload`
- `createAuditContentFingerprint`

**Does not** append to a new audit store. Integrator may persist via CORE-20 sink later.

## Redaction

Forbidden in public/governance payloads:

`grantedPermissions`, tokens, secrets, password, authorization, raw private profile, binary/base64, client grants.

## Side effects

`persistenceSideEffect: false`, `ownsAuditStorage: false`.
