/**
 * Identity-backed RefereeDirectoryPort for trusted-server CORE-13.
 *
 * Contract #08 Adapter B forbids owning referee identity. Canonical referee
 * user identity remains Identity-domain (profiles.role = REFEREE, active,
 * tenant-bound). This port translates that evidence into CORE-13 candidates.
 *
 * It MUST NOT synthesize qualification or availability.
 */

import { normalizeRole, ROLES } from "../../../../../identity/constants/roles.js";
import {
  createRefereeCandidate,
} from "../../../../../competition-core/referee-assignment/index.js";
import {
  createEmptySnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "../../../../../competition-core/referee-assignment/ports/portResult.js";
import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { isUuid } from "./loadCanonicalCompetitionModeState.js";

function isCanonicalRefereeIdentityRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === ROLES.REFEREE) return true;
  const raw = String(role || "").trim().toUpperCase();
  return raw === "HEAD_REFEREE" || raw === "SCOREKEEPER";
}

/**
 * @param {{ serviceClient: object }} options
 */
export function createIdentityBackedRefereeDirectoryPort(options = {}) {
  const serviceClient = options.serviceClient;

  return Object.freeze({
    source: "IDENTITY_PROFILES_REFEREE_ROLE",
    synthesizesQualification: false,
    synthesizesAvailability: false,
    async resolveRefereeDirectory(request = {}) {
      const refereeId = String(request.refereeId || "").trim();
      const tenantId = String(request.tenantId || "").trim();
      if (!refereeId) {
        return createEmptySnapshotResult(
          "No refereeId supplied for Identity directory lookup"
        );
      }
      if (!isUuid(refereeId)) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical referee identity must be a UUID with Identity-domain evidence",
          { refereeId }
        );
      }
      if (!serviceClient || typeof serviceClient.from !== "function") {
        return createMissingSnapshotResult(
          "Identity-backed referee directory is unavailable",
          { refereeId }
        );
      }

      const { data: profile, error } = await serviceClient
        .from("profiles")
        .select("id, display_name, role, venue_id, status")
        .eq("id", refereeId)
        .maybeSingle();

      if (error) {
        return createMissingSnapshotResult(
          "Identity-backed referee directory lookup failed",
          { refereeId, error: error.message || String(error) }
        );
      }
      if (!profile?.id) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical referee Identity evidence was not found",
          { refereeId }
        );
      }

      const profileTenant = String(profile.venue_id || "").trim();
      if (profileTenant && tenantId && profileTenant !== tenantId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED,
          "Referee identity is not bound to the authenticated tenant",
          { refereeId, profileTenant, tenantId }
        );
      }

      if (!isCanonicalRefereeIdentityRole(profile.role)) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Referee identity/source evidence is required (Identity role)",
          { refereeId, role: profile.role || null }
        );
      }

      const active = String(profile.status || "active").toLowerCase() !== "inactive";
      return createPopulatedSnapshotResult([
        createRefereeCandidate({
          refereeId,
          active,
          userId: refereeId,
          displayLabel: profile.display_name || undefined,
        }),
      ]);
    },
  });
}
