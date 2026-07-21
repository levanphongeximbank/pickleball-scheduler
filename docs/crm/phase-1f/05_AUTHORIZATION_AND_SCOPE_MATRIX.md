# 05 — Authorization and Scope Matrix (Phase 1F)

**Status:** Checklist / matrix

---

## Tag permissions

| Permission | Commands |
|------------|----------|
| `crm.tag.create` | `createTag` |
| `crm.tag.view` | `getTag`, `listTags`, `listTagsForTarget`, `listTargetsByTag` |
| `crm.tag.update` | `activateTag`, `deactivateTag` |
| `crm.tag.assign` | `assignTag`, `removeTag` |

## Consent permissions

| Permission | Commands |
|------------|----------|
| `crm.consent.create` | `grantConsent` |
| `crm.consent.view` | `getConsent`, `listConsentHistory`, `getEffectiveConsent`, `listEffectiveConsents` |
| `crm.consent.revoke` | `revokeConsent` |

## Pending event dispatch

| Permission | Commands |
|------------|----------|
| `crm.audit.view` | All pending dispatch services |

## Rejected cases (all commands)

| Scenario | Code |
|----------|------|
| Missing actor | `CRM_MISSING_ACTOR` |
| Missing scope | `CRM_MISSING_SCOPE` |
| Missing permission | `CRM_FORBIDDEN_PERMISSION` |
| Cross-tenant / cross-venue | `CRM_FORBIDDEN_SCOPE` |
| Missing aggregate | `CRM_NOT_FOUND` |
| Invalid input / status | `CRM_INVALID_INPUT` / `CRM_INVALID_STATUS` |
| Invalid transition | `CRM_INVALID_TRANSITION` |
| Duplicate tag code | `CRM_IDEMPOTENCY_CONFLICT` |
| Invalid envelope / unsafe payload | `CRM_INVALID_ENVELOPE` |

All commands fail closed. Role names are not permission evidence.
