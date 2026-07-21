/**
 * Resolve Tag assignment targets within tenant/venue scope (Phase 1F).
 *
 * Fail-closed. Never silently creates missing aggregates.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { TAG_TARGET_TYPE, isTagTargetType } from "../constants/tagTargetTypes.js";

/**
 * @param {object} params
 * @param {{ tenantId: string, venueId: string }} params.scope
 * @param {string} params.targetType
 * @param {string} params.targetId
 * @param {{ getById: Function }} params.contactReferenceRepository
 * @param {{ getById: Function }} [params.leadRepository]
 * @param {{ getById: Function }} [params.opportunityRepository]
 */
export async function resolveTagTarget({
  scope,
  targetType,
  targetId,
  contactReferenceRepository,
  leadRepository = null,
  opportunityRepository = null,
}) {
  const type = String(targetType || "").trim();
  const id = String(targetId || "").trim();

  if (!type || !isTagTargetType(type)) {
    return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, `Invalid tag target type: ${type}`);
  }
  if (!id) {
    return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "targetId is required.");
  }

  if (type === TAG_TARGET_TYPE.CONTACT_REFERENCE) {
    const contactRef = await contactReferenceRepository.getById(scope, id);
    if (!contactRef) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "ContactReference not found in the requested tenant/venue scope."
      );
    }
    return { ok: true, targetType: type, targetId: id, target: contactRef };
  }

  if (type === TAG_TARGET_TYPE.LEAD) {
    if (!leadRepository) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Lead repository is required for LEAD tag targets."
      );
    }
    const lead = await leadRepository.getById(scope, id);
    if (!lead) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "Lead not found in the requested tenant/venue scope."
      );
    }
    return { ok: true, targetType: type, targetId: id, target: lead };
  }

  if (type === TAG_TARGET_TYPE.OPPORTUNITY) {
    if (!opportunityRepository) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Opportunity repository is required for OPPORTUNITY tag targets."
      );
    }
    const opportunity = await opportunityRepository.getById(scope, id);
    if (!opportunity) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "Opportunity not found in the requested tenant/venue scope."
      );
    }
    return { ok: true, targetType: type, targetId: id, target: opportunity };
  }

  return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, `Unsupported tag target type: ${type}`);
}
