/**
 * Public Portal surface readiness descriptor factory (EC-01).
 * Pure metadata — no ranking/scoring/standings/eligibility logic.
 */

import {
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_ID,
  EXPERIENCE_CHANNEL_READINESS,
  EXPERIENCE_CHANNEL_VISIBILITY,
  isExperienceChannelClassification,
  isExperienceChannelId,
  isExperienceChannelReadiness,
  isExperienceChannelVisibility,
} from "../../constants/index.js";
import { deepFreeze, failContract, isNonEmptyString, isPlainObject } from "../../contracts/shared.js";
import {
  isPublicPortalAuthDependency,
  isPublicPortalCompetitionMarker,
  isPublicPortalDataSource,
  isPublicPortalSurfaceId,
  isPublicPortalTenantDependency,
  PUBLIC_PORTAL_COMPETITION_MARKER,
  PUBLIC_PORTAL_DATA_SOURCE,
} from "../constants/index.js";

/**
 * @typedef {Object} PublicPortalSurfaceDescriptorInput
 * @property {string} surfaceId
 * @property {string} routePattern
 * @property {string} ownerChannelId
 * @property {string} visibility
 * @property {string} collisionClassification
 * @property {string} dataSource
 * @property {string} [dataSourceNotes]
 * @property {string} authenticationDependency
 * @property {string} tenantDependency
 * @property {string} competitionOwnershipMarker
 * @property {string} responsiveState
 * @property {string} accessibilityState
 * @property {string} seoState
 * @property {string} loadingStateReadiness
 * @property {string} errorStateReadiness
 * @property {string} emptyStateReadiness
 * @property {string} offlinePwaState
 * @property {string} testCoverageState
 * @property {string} overallReadiness
 * @property {boolean} safeForRemediation
 * @property {string} [deferReason]
 * @property {readonly string[]} [evidenceReferences]
 * @property {string} [notes]
 * @property {string} [pagePathHint]
 * @property {string} [shellPathHint]
 */

/**
 * @param {PublicPortalSurfaceDescriptorInput} input
 * @returns {Readonly<PublicPortalSurfaceDescriptorInput>}
 */
export function createPublicPortalSurfaceDescriptor(input) {
  if (!isPlainObject(input)) {
    failContract("INVALID_PUBLIC_SURFACE", "Public portal surface must be a plain object");
  }

  const surfaceId = String(input.surfaceId ?? "").trim();
  const routePattern = String(input.routePattern ?? "").trim();
  const ownerChannelId = String(input.ownerChannelId ?? "").trim();
  const visibility = String(input.visibility ?? "").trim();
  const collisionClassification = String(input.collisionClassification ?? "").trim();
  const dataSource = String(input.dataSource ?? "").trim();
  const dataSourceNotes = input.dataSourceNotes == null ? "" : String(input.dataSourceNotes).trim();
  const authenticationDependency = String(input.authenticationDependency ?? "").trim();
  const tenantDependency = String(input.tenantDependency ?? "").trim();
  const competitionOwnershipMarker = String(input.competitionOwnershipMarker ?? "").trim();
  const responsiveState = String(input.responsiveState ?? "").trim();
  const accessibilityState = String(input.accessibilityState ?? "").trim();
  const seoState = String(input.seoState ?? "").trim();
  const loadingStateReadiness = String(input.loadingStateReadiness ?? "").trim();
  const errorStateReadiness = String(input.errorStateReadiness ?? "").trim();
  const emptyStateReadiness = String(input.emptyStateReadiness ?? "").trim();
  const offlinePwaState = String(input.offlinePwaState ?? "").trim();
  const testCoverageState = String(input.testCoverageState ?? "").trim();
  const overallReadiness = String(input.overallReadiness ?? "").trim();
  const safeForRemediation = Boolean(input.safeForRemediation);
  const deferReason = input.deferReason == null ? "" : String(input.deferReason).trim();
  const notes = input.notes == null ? "" : String(input.notes).trim();
  const pagePathHint = input.pagePathHint == null ? "" : String(input.pagePathHint).trim();
  const shellPathHint = input.shellPathHint == null ? "" : String(input.shellPathHint).trim();
  const evidenceReferences = Array.isArray(input.evidenceReferences)
    ? input.evidenceReferences.map((e) => String(e).trim()).filter(Boolean)
    : [];

  if (!isPublicPortalSurfaceId(surfaceId)) {
    failContract("INVALID_SURFACE_ID", `Unknown public portal surfaceId: ${surfaceId}`, {
      surfaceId,
    });
  }
  if (!isNonEmptyString(routePattern)) {
    failContract("INVALID_ROUTE_PATTERN", "routePattern is required", { surfaceId });
  }
  if (!isExperienceChannelId(ownerChannelId)) {
    failContract("INVALID_OWNER_CHANNEL", `Unknown ownerChannelId: ${ownerChannelId}`, {
      surfaceId,
      ownerChannelId,
    });
  }
  if (ownerChannelId !== EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL) {
    failContract(
      "OWNER_MUST_BE_PUBLIC_PORTAL",
      "Certified public portal surfaces must be owned by public-portal channel",
      { surfaceId, ownerChannelId }
    );
  }
  if (!isExperienceChannelVisibility(visibility)) {
    failContract("INVALID_VISIBILITY", `Invalid visibility: ${visibility}`, { surfaceId });
  }
  if (visibility !== EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC) {
    failContract("PUBLIC_VISIBILITY_REQUIRED", "EC-01 surfaces must use PUBLIC visibility", {
      surfaceId,
      visibility,
    });
  }
  if (!isExperienceChannelClassification(collisionClassification)) {
    failContract(
      "INVALID_COLLISION_CLASSIFICATION",
      `Invalid collisionClassification: ${collisionClassification}`,
      { surfaceId }
    );
  }
  if (!isPublicPortalDataSource(dataSource)) {
    failContract("INVALID_DATA_SOURCE", `Invalid dataSource: ${dataSource}`, { surfaceId });
  }
  if (
    (dataSource === PUBLIC_PORTAL_DATA_SOURCE.MIXED ||
      dataSource === PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN) &&
    !isNonEmptyString(dataSourceNotes)
  ) {
    failContract("MIXED_DATA_NOTES_REQUIRED", "MIXED/UNKNOWN dataSource requires dataSourceNotes", {
      surfaceId,
      dataSource,
    });
  }
  if (!isPublicPortalAuthDependency(authenticationDependency)) {
    failContract("INVALID_AUTH_DEPENDENCY", `Invalid authenticationDependency`, { surfaceId });
  }
  if (!isPublicPortalTenantDependency(tenantDependency)) {
    failContract("INVALID_TENANT_DEPENDENCY", `Invalid tenantDependency`, { surfaceId });
  }
  if (!isPublicPortalCompetitionMarker(competitionOwnershipMarker)) {
    failContract("INVALID_COMPETITION_MARKER", `Invalid competitionOwnershipMarker`, {
      surfaceId,
    });
  }

  const readinessFields = {
    responsiveState,
    accessibilityState,
    seoState,
    loadingStateReadiness,
    errorStateReadiness,
    emptyStateReadiness,
    offlinePwaState,
    testCoverageState,
    overallReadiness,
  };
  for (const [key, value] of Object.entries(readinessFields)) {
    if (!isExperienceChannelReadiness(value)) {
      failContract("INVALID_READINESS_DIMENSION", `Invalid ${key}: ${value}`, { surfaceId, key });
    }
  }

  if (
    competitionOwnershipMarker === PUBLIC_PORTAL_COMPETITION_MARKER.COMPETITION_E2E_OWNED &&
    safeForRemediation
  ) {
    failContract(
      "COMPETITION_NOT_SAFE_REMEDIATION",
      "Competition E2E-owned surfaces cannot be safeForRemediation",
      { surfaceId }
    );
  }

  if (
    collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED &&
    safeForRemediation
  ) {
    failContract(
      "COMPETITION_CLASSIFICATION_NOT_SAFE",
      "COMPETITION_E2E_OWNED classification cannot be safeForRemediation",
      { surfaceId }
    );
  }

  const isDeferred =
    collisionClassification === EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED ||
    overallReadiness === EXPERIENCE_CHANNEL_READINESS.DEFERRED;

  if (isDeferred && !isNonEmptyString(deferReason)) {
    failContract("MISSING_DEFER_REASON", "Deferred surfaces require deferReason", { surfaceId });
  }

  if (
    (dataSource === PUBLIC_PORTAL_DATA_SOURCE.MOCK ||
      dataSource === PUBLIC_PORTAL_DATA_SOURCE.PREVIEW) &&
    overallReadiness === EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED
  ) {
    failContract(
      "MOCK_NOT_PRODUCTION_READY",
      "MOCK/PREVIEW dataSource cannot claim overallReadiness IMPLEMENTED",
      { surfaceId, dataSource }
    );
  }

  if (overallReadiness === EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED) {
    for (const key of ["loadingStateReadiness", "errorStateReadiness", "emptyStateReadiness"]) {
      const value = readinessFields[key];
      if (
        value === EXPERIENCE_CHANNEL_READINESS.MISSING ||
        value === EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED
      ) {
        failContract(
          "PRODUCTION_STATE_EVIDENCE_REQUIRED",
          `overallReadiness IMPLEMENTED requires ${key} evidence (not MISSING/NOT_VERIFIED)`,
          { surfaceId, key, value }
        );
      }
    }
  }

  if (
    accessibilityState === EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED &&
    overallReadiness === EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED
  ) {
    failContract(
      "A11Y_NOT_VERIFIED_NOT_COMPLIANT",
      "accessibility NOT_VERIFIED cannot claim overall IMPLEMENTED",
      { surfaceId }
    );
  }

  if (
    responsiveState === EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED &&
    overallReadiness === EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED
  ) {
    failContract(
      "RESPONSIVE_NOT_VERIFIED_NOT_READY",
      "responsive NOT_VERIFIED cannot claim overall IMPLEMENTED",
      { surfaceId }
    );
  }

  return deepFreeze({
    surfaceId,
    routePattern,
    ownerChannelId,
    visibility,
    collisionClassification,
    dataSource,
    dataSourceNotes,
    authenticationDependency,
    tenantDependency,
    competitionOwnershipMarker,
    responsiveState,
    accessibilityState,
    seoState,
    loadingStateReadiness,
    errorStateReadiness,
    emptyStateReadiness,
    offlinePwaState,
    testCoverageState,
    overallReadiness,
    safeForRemediation,
    deferReason,
    evidenceReferences: Object.freeze(evidenceReferences),
    notes,
    pagePathHint,
    shellPathHint,
  });
}

/**
 * @typedef {Object} PublicPortalBoundaryDescriptorInput
 * @property {string} boundaryId
 * @property {string} routePattern
 * @property {string} ownerChannelId
 * @property {string} visibility
 * @property {string} collisionClassification
 * @property {string} competitionOwnershipMarker
 * @property {boolean} safeForRemediation
 * @property {string} deferReason
 * @property {string} [notes]
 * @property {readonly string[]} [evidenceReferences]
 */

/**
 * Adjacent non-portal surfaces (ownership / collision markers only).
 * @param {PublicPortalBoundaryDescriptorInput} input
 * @returns {Readonly<PublicPortalBoundaryDescriptorInput>}
 */
export function createPublicPortalBoundaryDescriptor(input) {
  if (!isPlainObject(input)) {
    failContract("INVALID_BOUNDARY", "Boundary descriptor must be a plain object");
  }

  const boundaryId = String(input.boundaryId ?? "").trim();
  const routePattern = String(input.routePattern ?? "").trim();
  const ownerChannelId = String(input.ownerChannelId ?? "").trim();
  const visibility = String(input.visibility ?? "").trim();
  const collisionClassification = String(input.collisionClassification ?? "").trim();
  const competitionOwnershipMarker = String(input.competitionOwnershipMarker ?? "").trim();
  const safeForRemediation = Boolean(input.safeForRemediation);
  const deferReason = String(input.deferReason ?? "").trim();
  const notes = input.notes == null ? "" : String(input.notes).trim();
  const evidenceReferences = Array.isArray(input.evidenceReferences)
    ? input.evidenceReferences.map((e) => String(e).trim()).filter(Boolean)
    : [];

  if (!isNonEmptyString(boundaryId)) {
    failContract("INVALID_BOUNDARY_ID", "boundaryId is required");
  }
  if (!isNonEmptyString(routePattern)) {
    failContract("INVALID_ROUTE_PATTERN", "routePattern is required", { boundaryId });
  }
  if (!isExperienceChannelId(ownerChannelId)) {
    failContract("INVALID_OWNER_CHANNEL", `Unknown ownerChannelId: ${ownerChannelId}`);
  }
  if (!isExperienceChannelVisibility(visibility)) {
    failContract("INVALID_VISIBILITY", `Invalid visibility: ${visibility}`);
  }
  if (!isExperienceChannelClassification(collisionClassification)) {
    failContract("INVALID_COLLISION_CLASSIFICATION", `Invalid classification`);
  }
  if (!isPublicPortalCompetitionMarker(competitionOwnershipMarker)) {
    failContract("INVALID_COMPETITION_MARKER", `Invalid competitionOwnershipMarker`);
  }
  if (safeForRemediation) {
    failContract(
      "BOUNDARY_NOT_SAFE_REMEDIATION",
      "Boundary markers must not be marked safeForRemediation in EC-01",
      { boundaryId }
    );
  }
  if (!isNonEmptyString(deferReason)) {
    failContract("MISSING_DEFER_REASON", "Boundary markers require deferReason", { boundaryId });
  }
  if (
    competitionOwnershipMarker === PUBLIC_PORTAL_COMPETITION_MARKER.COMPETITION_E2E_OWNED &&
    collisionClassification !== EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED &&
    collisionClassification !== EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED
  ) {
    failContract(
      "COMPETITION_MARKER_MISMATCH",
      "COMPETITION_E2E_OWNED marker requires matching classification or DEFERRED",
      { boundaryId }
    );
  }

  return deepFreeze({
    boundaryId,
    routePattern,
    ownerChannelId,
    visibility,
    collisionClassification,
    competitionOwnershipMarker,
    safeForRemediation: false,
    deferReason,
    notes,
    evidenceReferences: Object.freeze(evidenceReferences),
  });
}
