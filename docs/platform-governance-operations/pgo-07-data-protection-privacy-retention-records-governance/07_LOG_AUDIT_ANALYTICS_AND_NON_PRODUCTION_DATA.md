# 07 — Log, Audit, Analytics And Non-Production Data

## Data separation

| Class | Primary purpose | Required boundary |
|---|---|---|
| Technical log | Reliability and diagnosis | Minimized payload, short approved retention, restricted operations access |
| Security audit | Authentication, authorization, privileged and boundary evidence | Tamper-resistant path, Security/Data Owner access |
| Business audit | Domain action and accountability | Module/Records Owner policy; not automatically a security log |
| Analytics | Aggregated insight and measurement | Purpose-specific dataset, aggregation, cohort protection |
| Incident evidence | Investigation and decision history | Case scope, chain of custody, hold-aware retention |

Data must not move between these classes merely because a common platform can store it.

## Redaction and emission standard

Prefer opaque actor, tenant, request, correlation, and provider references. Record action, result code, timestamp, source class, and minimum diagnostic context.

Prohibited content includes credential values, session material, authentication challenges, private keys, connection secrets, payment card security data, unrestricted personal profiles, unrelated tenant content, and uncontrolled user-entered text. Errors shown to broad audiences must not expose internal sensitive context.

PGO-03 is the source of truth for security audit logging and log redaction/retention governance. Its external retention claims and duration targets are not certified.

## Analytics governance

- Define an approved purpose and metric dictionary before collection.
- Prefer aggregate or de-identified measures over subject-level events.
- Minimize event fields and avoid stable direct identifiers where unnecessary.
- Enforce tenant scope and suppress outputs that expose individuals or small cohorts.
- Do not repurpose audit or support data as analytics without a new authority review.
- Document source lineage, transformations, quality limits, access, retention, and deletion behavior.

## Non-Production data

Development, Test, Preview, Demo, QA, training, and local environments may use:

- purpose-built synthetic records;
- deterministic fixtures containing fictional values;
- seeds that create non-identifying structural examples;
- mocks/fakes that do not call Production services.

They must not use copied, sampled, masked, pseudonymized, screenshotted, exported, restored, or otherwise Production-derived data. Test names and contact fields must be visibly fictional and non-routable. Fixtures must not contain secrets or live identifiers.

Repository examples include `src/demo/seed/`, in-memory sources, fake database clients, mocks, and test fixtures. Their presence does not prove every test artifact is synthetic; continuous review is required.

## Evidence and access

Log/audit/analytics access and export require purpose, minimum scope, authorized role, time range, redaction, recipient, expiry, and evidence reference. Screenshots and support attachments are copies subject to the same controls.

## Readiness gaps

Missing evidence includes a complete event catalog, live sink inventory, field-level redaction verification, approved analytics purposes, aggregation thresholds, provider retention, non-Production dataset attestations, and disposal proof.

```text
DATA_READINESS: NOT_READY
TARGETS: PROVISIONAL_NOT_CERTIFIED
EXTERNAL_PROCESSORS: NOT_VERIFIED
```
