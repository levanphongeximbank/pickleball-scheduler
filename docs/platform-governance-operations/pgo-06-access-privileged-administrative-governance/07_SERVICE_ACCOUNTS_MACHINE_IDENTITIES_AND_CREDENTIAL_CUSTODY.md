# 07 — Service Accounts, Machine Identities And Credential Custody

**Workstream:** PGO-06
**Rule:** Custody policy only. **Do not read or write real credentials.** Service-role capability is not proof of use.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Service account** | Non-human account used by automation, backends, or integrations | Must have owner, purpose, scope, and lifecycle |
| **Machine identity** | Identity representing a host, pipeline, function, or workload | Same inventory and custody obligations as service accounts |
| **Workload identity** | Platform-issued identity for a specific runtime workload | Preferred over long-lived shared secrets when available |
| **Owner** | Named human accountable for the non-human identity | Required; ownerless identities are orphans |
| **Purpose** | Documented business/technical reason for existence | Required for approval and review |
| **Least privilege** | Minimum permissions and network/data scope for the purpose | Excess privilege is a finding |
| **Credential custody** | Controlled storage, access, and handling of secrets for the identity | Aligns with PGO-04 secret custody; no values in docs |
| **Rotation** | Periodic or event-driven replacement of credentials | Required; schedule is Owner-approved when certified |
| **Revocation** | Immediate invalidation of credentials/identity | Required on compromise, leaver of owner, or end of purpose |
| **Expiry** | Predetermined end of credential or identity validity | Expired credentials must not remain usable |
| **Non-interactive use** | Authentication without human login UX | Expected mode for service/machine identities |
| **Human-login prohibition** | Ban on using service/machine credentials for interactive human administration | Violations are privileged-access findings |
| **Orphan detection** | Process to find identities without owner, purpose, or usage | Required input to access review |

## Repository evidence (read-only; names/patterns only)

| Evidence | Path examples | What it proves | What it does not prove |
|---|---|---|---|
| API key store / service-role boundary | `src/features/api/config/apiKeyStoreConfig.js`, API repositories | Intended server-only service-role usage pattern | That Production service-role was used |
| API key create/rotate/revoke audit actions | `src/features/api/` | Machine-oriented key lifecycle capability | Complete service-account inventory attestation |
| Supabase `service_role` grants in SQL docs | Multiple `docs/supabase-*.sql` packs | Declared privileged backend capability | Credential custody attestation |
| CI secret **names** | Workflow references documented in PGO-04 | Named secret slots in repo evidence | Live console values or access lists |

## Custody non-negotiables

1. Never commit credential values to the repository.
2. Never paste secret values into PGO documentation.
3. Human interactive login with service-role or machine credentials is prohibited.
4. Service-account inventory and credential-custody attestation are required for readiness beyond `NOT_READY`.

## Honest status

```text
SERVICE_ACCOUNT_INVENTORY: MISSING
CREDENTIAL_CUSTODY_ATTESTATION: MISSING
CONTRIBUTES_TO: NOT_READY
```

Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
