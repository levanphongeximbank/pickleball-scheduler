/**
 * Shared same-scope relationship resolution for Interaction / Task commands (Phase 1E).
 *
 * Fail-closed. Never silently creates ContactReference, Lead, Opportunity, or Interaction.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";

/**
 * @param {object} params
 * @param {{ tenantId: string, venueId: string }} params.scope
 * @param {string} params.contactRefId
 * @param {string|null} [params.leadId]
 * @param {string|null} [params.opportunityId]
 * @param {string|null} [params.sourceInteractionId]
 * @param {{ getById: Function }} params.contactReferenceRepository
 * @param {{ getById: Function }} [params.leadRepository]
 * @param {{ getById: Function }} [params.opportunityRepository]
 * @param {{ getById: Function }} [params.interactionRepository]
 */
export async function resolveCrmRelationshipRefs({
  scope,
  contactRefId,
  leadId = null,
  opportunityId = null,
  sourceInteractionId = null,
  contactReferenceRepository,
  leadRepository = null,
  opportunityRepository = null,
  interactionRepository = null,
}) {
  const contactRef = await contactReferenceRepository.getById(scope, contactRefId);
  if (!contactRef) {
    return crmFailure(
      CRM_ERROR_CODES.NOT_FOUND,
      "ContactReference not found in the requested tenant/venue scope."
    );
  }

  let lead = null;
  if (leadId) {
    if (!leadRepository) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Lead repository is required when leadId is provided."
      );
    }
    lead = await leadRepository.getById(scope, leadId);
    if (!lead) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "Lead not found in the requested tenant/venue scope."
      );
    }
    if (!lead.contactRefId || lead.contactRefId !== contactRefId) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Lead contactRefId must match the Interaction/Task contactRefId."
      );
    }
  }

  let opportunity = null;
  if (opportunityId) {
    if (!opportunityRepository) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Opportunity repository is required when opportunityId is provided."
      );
    }
    opportunity = await opportunityRepository.getById(scope, opportunityId);
    if (!opportunity) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "Opportunity not found in the requested tenant/venue scope."
      );
    }
    if (!opportunity.contactRefId || opportunity.contactRefId !== contactRefId) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Opportunity contactRefId must match the Interaction/Task contactRefId."
      );
    }
  }

  if (lead && opportunity && lead.contactRefId !== opportunity.contactRefId) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_INPUT,
      "Lead and Opportunity must refer to the same contactRefId."
    );
  }

  let sourceInteraction = null;
  if (sourceInteractionId) {
    if (!interactionRepository) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Interaction repository is required when sourceInteractionId is provided."
      );
    }
    sourceInteraction = await interactionRepository.getById(scope, sourceInteractionId);
    if (!sourceInteraction) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "Source Interaction not found in the requested tenant/venue scope."
      );
    }
    if (
      !sourceInteraction.contactRefId ||
      sourceInteraction.contactRefId !== contactRefId
    ) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Source Interaction contactRefId must match the Task contactRefId."
      );
    }
  }

  return {
    ok: true,
    contactRef,
    lead,
    opportunity,
    sourceInteraction,
  };
}

/**
 * Resolve an assignment target through IdentityActorPort (fail-closed).
 *
 * @param {object} scope
 * @param {string} actorUserId
 * @param {{ resolveActor?: Function }|null} identityActorPort
 */
export async function resolveAssignableActor(scope, actorUserId, identityActorPort) {
  if (!identityActorPort?.resolveActor) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_INPUT,
      "IdentityActorPort.resolveActor is required to assign a CRM task."
    );
  }
  const target = await identityActorPort.resolveActor(scope, actorUserId);
  if (!target || typeof target !== "object") {
    return crmFailure(
      CRM_ERROR_CODES.NOT_FOUND,
      "Assignment target actor was not found."
    );
  }
  if (target.active === false) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_INPUT,
      "Assignment target actor is inactive."
    );
  }
  const targetTenant =
    typeof target.tenantId === "string" ? target.tenantId.trim() : "";
  if (!targetTenant || targetTenant !== scope.tenantId) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Assignment target belongs to a different tenant."
    );
  }
  const targetVenues = Array.isArray(target.venueIds)
    ? target.venueIds.map(String).filter(Boolean)
    : [];
  if (targetVenues.length > 0 && !targetVenues.includes(scope.venueId)) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Assignment target is not allowed in this venue."
    );
  }
  return { ok: true, target };
}
