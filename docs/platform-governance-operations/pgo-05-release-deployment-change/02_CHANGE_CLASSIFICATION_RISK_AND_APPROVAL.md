# 02 — Change Classification, Risk And Approval

## Change classes

| Class | Examples | Mandatory considerations |
|---|---|---|
| **Documentation-only** | Policy, checklist, non-executable guidance | Path scope, factual accuracy, no operational commands or credentials |
| **Source-code** | Application, API, scripts, tests | Tests, lint, build, security, runtime compatibility |
| **Dependency** | Manifest or lockfile change | Provenance, vulnerability, license, deterministic lockfile, rollback |
| **Configuration** | Tracked or external environment settings | PGO-04 ownership, drift, secret boundary, environment-specific approval |
| **Feature flag** | Flag definition/default/targeting/expiry | PGO-04 authority, activation/disablement evidence, no security bypass |
| **Database/schema** | Schema, RLS, function, migration | Database Owner, backup/compatibility, ordered migration and recovery plan |
| **Data correction** | Repair, backfill, deletion, reconciliation | Scope, auditability, dry-run/review, privacy, compensating plan |
| **Infrastructure/platform** | Hosting, CI/CD, network, external service | Platform Operations, Security where relevant, blast radius, drift control |
| **Emergency/hotfix** | Urgent incident containment or correction | Incident reference, narrow scope, break-glass authority, retrospective |

Mixed changes inherit the strictest applicable controls. Renaming a risky operation as documentation or hotfix does not lower its classification.

## Risk levels

| Risk | Typical characteristics | Review and approval requirement |
|---|---|---|
| **LOW** | Reversible, isolated, no runtime/Production/security/data effect | One independent reviewer; owner of affected documentation/module |
| **MEDIUM** | Limited runtime or non-Production impact; understood recovery | Module Owner plus independent technical review; test evidence |
| **HIGH** | Production, shared platform, sensitive configuration, schema, or broad user impact | Module/Platform owner, relevant Security/Database review, explicit Owner GO |
| **CRITICAL** | Material outage, security boundary, irreversible data risk, emergency Production action | Incident governance, named break-glass authority, independent approval, explicit Owner GO and retrospective |

Risk is based on blast radius, reversibility, data/security impact, dependency coupling, observability, operational complexity, and evidence quality. Uncertainty raises risk; it does not justify a lower level.

## Approval model

Every change record must contain:

1. Change class and risk level with rationale.
2. Exact scope and affected environments.
3. Required reviewers and segregation of duties.
4. Test/gate and evidence expectations.
5. Recovery option and post-change verification.
6. Explicit Owner GO when Production, shared authority, HIGH, or CRITICAL controls require it.

**Owner GO** authorizes the stated scope only. It does not waive CI, evidence, Security, Database Owner, or external-platform authority requirements.

## Prohibited self-approval

- The proposer/implementer must not be the sole approver of their own material change.
- A person with platform access must not approve solely because they can execute.
- Emergency handling may shorten the sequence but must retain a second accountable authority whenever feasible and requires retrospective review.
- Owner GO does not convert missing evidence into completed evidence.

## Provisional governance targets

Until separately approved by Owner, all numeric or time-based targets remain:

| Target | Status |
|---|---|
| Change-window target | **`PROVISIONAL_NOT_CERTIFIED`** |
| Rollback-time target | **`PROVISIONAL_NOT_CERTIFIED`** |
| Approval SLA | **`PROVISIONAL_NOT_CERTIFIED`** |
| Evidence-retention target | **`PROVISIONAL_NOT_CERTIFIED`** |
