# 04 — Data Subject Request, Export And Portability

## Request classes

PGO-07 governs intake and evidence requirements for:

- access to applicable personal data and processing information;
- correction of inaccurate data;
- deletion where authorized and not overridden by valid retention;
- restriction or objection where applicable;
- export and portability in an approved, usable format.

This document does not determine legal entitlement in any jurisdiction and does not process a real request.

## Controlled workflow

1. Record a case identifier, request class, intake channel, received time, and accountable owner.
2. Verify identity proportionately without collecting unnecessary new data.
3. Establish tenant, subject, jurisdiction, authority, scope, and authorized representative status.
4. Search the approved system/copy inventory, including processors, logs, analytics, backups, and temporary copies as applicable.
5. Check legal hold, security, fraud, financial-record, third-party-rights, and other approved exceptions.
6. Obtain Data Owner and specialist decisions.
7. Produce a redacted response or controlled action through authorized operations.
8. Deliver through an approved secure channel.
9. Record outcome, exclusions, recipients, timestamps, and evidence references.

## Request-specific controls

| Request | Minimum control |
|---|---|
| Access | Return only the verified subject's applicable data; protect other subjects and restricted security details |
| Correction | Preserve authoritative history where required; propagate to approved dependent systems |
| Deletion | Check holds/retention first; track primary and residual-copy lifecycle |
| Restriction | Mark and enforce the restricted purpose/scope across relevant processing |
| Export | Minimize fields, redact third-party data, time-limit access, preserve integrity |
| Portability | Use a documented, interoperable format where applicable; explain excluded/derived data |

## Export package requirements

An authorized export package requires case ID, subject scope, source systems, extraction time, field manifest, format/version, redaction decision, integrity reference, approving roles, delivery method class, expiry, and destruction/closure evidence. It must not be committed to the repository.

## Access boundaries

- Support staff do not gain unrestricted data access from request intake.
- Technical access does not authorize disclosure or alteration.
- Authentication tokens, secrets, internal abuse controls, unrelated tenant data, and third-party personal data are excluded or redacted as required.
- Publicly visible data still requires identity and scope validation when included in a formal response.
- Provider support receives only the minimum approved information under processor governance.

## Unresolved gaps

The repository does not establish a complete subject-to-system index, verified request portal, approved response deadlines, jurisdiction matrix, portability schema, downstream propagation proof, or completed request evidence. All timing targets remain provisional.

```text
DATA_READINESS: NOT_READY
TARGETS: PROVISIONAL_NOT_CERTIFIED
LEGAL_COMPLIANCE: NOT_CERTIFIED
```
