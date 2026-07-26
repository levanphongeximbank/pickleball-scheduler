# 06 — External Processor, Sharing And Cross-Platform Data

## Processor governance rule

An external service may receive data only after the Data Owner documents the purpose, data classes, subjects, fields, environment, processing instructions, locations, security controls, retention/deletion behavior, subprocessors, incident duties, subject-request support, return/disposal terms, and approval authority.

Repository references to an SDK, adapter, workflow, environment-variable name, or provider configuration establish technical intent only. They do not verify a contract, live enablement, data flow, processor role, region, plan, or compliance.

## Repository-observed provider surfaces

| Surface | Potential processing | Current evidence status |
|---|---|---|
| Supabase | Database, authentication, storage, realtime, logs, recovery capability | Repository integration/config intent; external terms and live state **`NOT_VERIFIED`** |
| Vercel | Hosting, runtime/deploy logs, analytics where enabled | Config/docs intent; live project and processing **`NOT_VERIFIED`** |
| Netlify | Hosting/deploy surface if used | Tracked references; current use and processing **`NOT_VERIFIED`** |
| GitHub / Actions | Source, CI metadata, artifacts, logs, issue/PR records | Repository/workflow evidence; org settings and retention **`NOT_VERIFIED`** |
| Notification providers | Message routing, delivery metadata, device/channel identifiers | Adapter/foundation evidence; Production Phase 2C **`DEFERRED_BY_OWNER`** |
| Payment providers | Payment events, provider references, reconciliation metadata | Payment integration evidence; processor contract and live scope **`NOT_VERIFIED`** |
| Analytics providers | Usage/technical analytics where enabled | Product analytics surfaces exist; external collection/config **`NOT_VERIFIED`** |

No external console or provider API was accessed for this audit.

## Sharing decision

Before sharing, record:

1. sender, recipient, processor/controller role, and accountable owners;
2. approved purpose and minimum field allow-list;
3. tenant, subject, geography, and environment scope;
4. transfer mechanism class and access controls;
5. contract/instruction and subprocessor references;
6. retention, return, deletion, hold, incident, and request obligations;
7. cross-border/region assessment by authorized legal/privacy specialists;
8. approval, review date, and termination plan.

## Cross-platform controls

- Preserve tenant and purpose boundaries through every hop.
- Use opaque references instead of direct identifiers where sufficient.
- Do not place secrets, credentials, payment card data, unrestricted profiles, or unrelated tenant content in logs, tickets, source control, or provider support messages.
- Redact diagnostic evidence before external sharing.
- Reconcile corrections, restrictions, deletions, holds, and processor termination across recipients.
- Disable or fail closed when required processor authority is absent.

## Unresolved gaps

There is no complete approved processor/subprocessor inventory, contract and instruction register, region/transfer assessment, live data-flow verification, provider retention/deletion attestation, or termination evidence.

```text
EXTERNAL_PROCESSORS: NOT_VERIFIED
LEGAL_COMPLIANCE: NOT_CERTIFIED
DATA_READINESS: NOT_READY
NOTIFICATION_PHASE_2C: DEFERRED_BY_OWNER
```
