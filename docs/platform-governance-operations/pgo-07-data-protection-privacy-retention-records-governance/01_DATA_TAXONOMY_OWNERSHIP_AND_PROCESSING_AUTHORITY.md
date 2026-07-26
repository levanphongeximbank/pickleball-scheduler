# 01 — Data Taxonomy, Ownership And Processing Authority

## Classification model

| Class | Repository evidence examples | Default handling |
|---|---|---|
| Tenant data | Club, venue, season, league, competition, and tenant-scoped identifiers | Isolate by tenant; least privilege; no cross-tenant reuse |
| Personal data | Profile identity/contact attributes, player records, subject-linked activity | Purpose-bound, minimized, access-controlled |
| Sensitive data | Birth-related attributes, precise/private location, private rules, restricted profile settings | Fail closed; explicit authority; avoid logs and public projections |
| Authentication data | Auth-user references, sessions, role/permission relationships | Security boundary; never expose tokens or credential values |
| Financial data | Subscription, billing, payment event, invoice, and finance audit metadata | Financial owner authority; strict processor and audit boundary |
| Operational data | Competition state, scheduling, courts, notifications, service diagnostics | Tenant/module scope; approved operational purpose |
| Audit data | Actor references, actions, outcomes, timestamps, evidence references | Tamper-resistant path; restricted access; approved retention |
| Analytics data | Aggregates, trends, performance and customer/player analytics | Prefer aggregation or de-identification; prohibit purpose drift |
| Public data | Explicitly allow-listed and eligible public content/profile projection | Public only after policy checks; public does not mean unrestricted reuse |

Classification is cumulative. A record may be tenant, personal, financial, and audit data simultaneously; the strictest applicable control governs.

## Roles and accountability

| Role | Authority and responsibility |
|---|---|
| Data Owner | Defines approved purpose, audience, access, retention, request response, and disposal |
| Records Owner | Determines record status, provenance, archive, hold, and disposal authorization |
| Data Custodian | Operates storage and safeguards only under approved policy |
| Module Owner | Documents module semantics and validates minimum necessary fields |
| Security Owner | Reviews authentication, sensitive, audit, and incident evidence controls |
| Processor | Handles data only under documented Data Owner instructions |
| Subprocessor | Requires processor-chain approval and equivalent restrictions |
| Owner | Grants required Production GO and final certification |

No role may infer processing authority from technical access alone. Custody is not ownership; code authorship is not processing authority; provider capability is not authorization.

## Processing-authority register

Every processing activity requires:

1. named Data Owner and accountable module;
2. data classes and subjects affected;
3. explicit purpose and approved authority reference;
4. source, destination, environment, recipients, and processor chain;
5. minimum fields and access boundary;
6. retention, archive, hold, and disposal state;
7. subject-request applicability;
8. evidence owner and review date.

Missing fields block certification and remain **`NOT_READY`**.

## Repository evidence and gaps

- `src/context/TenantContext.jsx` and club/venue services indicate tenant-scoped design intent.
- `src/features/player/` and `docs/player-management/` identify profile privacy, public projection, and authentication-correlation boundaries.
- `src/features/finance/`, `src/features/billing/`, and payment documentation indicate distinct financial/audit classes.
- `src/features/identity/` and PGO-03 identify security audit categories.
- `src/features/intelligence-analytics/` indicates analytics processing surfaces.
- `src/features/news-public-content/` indicates explicit public projection surfaces.

The repository does not provide an Owner-attested, complete Production data inventory, processing register, data-flow map, or processor roster. Ownership assignments and processing authorities therefore remain incomplete.

```text
DATA_READINESS: NOT_READY
TARGETS: PROVISIONAL_NOT_CERTIFIED
```
