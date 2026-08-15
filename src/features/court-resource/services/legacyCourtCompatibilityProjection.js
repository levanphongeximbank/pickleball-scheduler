import { evaluateClubOperationalAccess } from "../contracts/clubOperationalAccess.js";
import { normalizeCanonicalPhysicalCourt } from "../contracts/canonicalPhysicalCourt.js";
import { resolveLegacyCourtIdentity } from "../contracts/legacyCourtIdentityMapping.js";

export function projectCanonicalCourtToLegacy(input = {}) {
  let court;
  try {
    court = normalizeCanonicalPhysicalCourt(input.canonicalCourt);
  } catch (error) {
    return Object.freeze({
      ok: false,
      code: "INVALID_CANONICAL_COURT",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const request = {
    tenantId: input.tenantId,
    clubId: input.clubId,
    sourceSystem: input.sourceSystem,
    sourceVersion: input.sourceVersion,
    legacyClusterId: input.legacyClusterId,
    legacyCourtId: input.legacyCourtId,
  };
  const mapping = resolveLegacyCourtIdentity(
    request,
    Array.isArray(input.mappings) ? input.mappings : []
  );
  if (!mapping.ok || mapping.physicalCourtId !== court.physicalCourtId) {
    return Object.freeze({ ok: false, code: "LEGACY_MAPPING_NOT_DETERMINISTIC", mapping });
  }
  const operationalAccess = evaluateClubOperationalAccess(
    {
      tenantId: request.tenantId,
      clubId: request.clubId,
      physicalCourtId: court.physicalCourtId,
    },
    Array.isArray(input.accessRows) ? input.accessRows : []
  );
  if (!operationalAccess.allowed) {
    return Object.freeze({
      ok: false,
      code: "CLUB_OPERATIONAL_ACCESS_DENIED",
      classification: mapping.classification,
      operationalAccess,
    });
  }
  return Object.freeze({
    ok: true,
    classification: mapping.classification,
    operationalAccess,
    value: Object.freeze({
      id: request.legacyCourtId,
      courtId: request.legacyCourtId,
      name: court.displayName,
      displayName: court.displayName,
      number: court.displayNumber,
      order: court.sortOrder,
      active: court.lifecycleStatus === "active",
      status: court.lifecycleStatus,
      clusterId: court.clusterId,
      physicalCourtId: court.physicalCourtId,
    }),
    source: "CANONICAL_READ_PROJECTION",
    dualWrite: false,
  });
}

export const projectLegacyCourtCompatibility = projectCanonicalCourtToLegacy;
