# 02 — Privacy Purpose, Minimization And Processing Limits

## Core rules

1. Collect, derive, read, share, and retain data only for an approved, documented purpose.
2. Limit fields, records, recipients, environments, precision, and duration to the minimum necessary.
3. Default visibility to private and processing to disabled until authority is established.
4. Enforce access at server/data boundaries; UI hiding alone is insufficient.
5. Keep tenant, authentication, financial, audit, analytics, and public purposes distinct.
6. Treat a new purpose, recipient, provider, model, or environment as a new review.

## Privacy by default

Repository evidence in `docs/player-management/phase-1i/02_PHASE_1I_DATA_PRIVACY_CONTRACT.md` describes an authenticated-first, opt-in directory, strict field allow-list, generic unavailable responses, and fail-closed defaults. `src/features/player/projectors/` provides projection boundaries. These are useful patterns but do not certify every product surface.

Required defaults:

- no public profile or discovery without an explicit eligibility decision;
- no contact, birth-related, authentication-correlation, tenant-membership, audit, or workflow-internal fields in public projections;
- opaque identifiers in operational and audit contexts where identity detail is unnecessary;
- coarse location rather than precise location where sufficient;
- aggregate analytics rather than subject-level detail where sufficient;
- no unrestricted free text when controlled codes meet the purpose.

## Purpose and access decision

| Question | Required evidence |
|---|---|
| Why is processing necessary? | Approved purpose and accountable Data Owner |
| Which data is necessary? | Field allow-list and exclusion list |
| Who may access it? | Role, tenant, environment, and recipient boundary |
| How is it enforced? | Server/RPC/RLS/service control evidence as applicable |
| How long is it needed? | Approved retention trigger and disposition |
| Can a less identifying form work? | Aggregation, pseudonymization, or omission assessment |
| Is reuse compatible? | Fresh Owner review; no inferred secondary purpose |

## Processing limits

- Authentication data is processed only for identity, session, authorization, security, and approved support purposes.
- Financial data is processed only for billing, payment, reconciliation, fraud/risk, and required records purposes.
- Audit data is not a general analytics feed.
- Analytics output must suppress unnecessary identifiers and small-cohort exposure.
- Public data remains subject to integrity, eligibility, withdrawal, and anti-enumeration controls.
- Notification data is limited to approved channel delivery and receipt evidence; Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
- Human review is required before a material automated inference changes access, eligibility, financial status, or another significant outcome.

## Change review

A privacy review is required before adding a field, expanding visibility, changing defaults, joining datasets, enabling a provider, using Production-derived content outside Production, or introducing a new analytics purpose. The review records purpose, necessity, alternatives, recipients, authority, retention, subject impact, and residual risk.

## Unresolved evidence

There is no complete, approved purpose register, field-level inventory, organization-wide privacy impact assessment, or live enforcement attestation. Existing module controls are partial evidence only.

```text
DATA_READINESS: NOT_READY
LEGAL_COMPLIANCE: NOT_CERTIFIED
```
