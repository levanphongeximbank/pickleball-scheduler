# 03 — Consent Domain and Effective State (Phase 1F)

**Status:** Implemented

---

## ConsentRecord aggregate

Append-only history. No destructive overwrite.

| Field | Required | Notes |
|-------|----------|-------|
| `consentId` | yes | |
| `tenantId` / `venueId` | yes | |
| `contactRefId` | yes | Must exist in scope |
| `channel` | yes | `EMAIL`, `SMS`, `PHONE`, `PUSH` |
| `purpose` | yes | `MARKETING`, `TRANSACTIONAL`, `SERVICE`, `RESEARCH` |
| `status` | yes | `GRANTED` or `REVOKED` |
| `source` | yes | Default `CRM` |
| `policyVersion` | yes | Non-empty |
| `effectiveAt` | yes | ISO-8601 |
| `expiresAt` | no | Must be after `effectiveAt` when present |
| `revokedAt` | no | Set on revoke records |
| `reason` | no | Required on revoke command |
| `recordedByActorId` | yes | |
| `createdAt` / `updatedAt` | yes | |

## Effective consent evaluation

At evaluation time `T`:

1. Filter same tenant/venue/contact/channel/purpose
2. `effectiveAt <= T`
3. `expiresAt` absent or `> T`
4. Newest `effectiveAt` wins
5. `createdAt` descending
6. `consentId` ascending tie-break

Revocation appends a new record — prior history preserved.

## Commands

| Command | Permission |
|---------|------------|
| `grantConsent` | `crm.consent.create` |
| `revokeConsent` | `crm.consent.revoke` |
| `getConsent` / `listConsentHistory` / `getEffectiveConsent` / `listEffectiveConsents` | `crm.consent.view` |

## Events

- `crm.audit.consent.granted`
- `crm.audit.consent.revoked`

No Notification or provider delivery in Phase 1F.
