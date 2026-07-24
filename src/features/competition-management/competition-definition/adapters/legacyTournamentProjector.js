/**
 * Legacy blob tournament → CompetitionDefinition compatibility projector (CM-01).
 *
 * Direction: legacy_tournament → canonical CompetitionDefinition (read compatibility only).
 * Does NOT mutate legacy objects. Does NOT write. Does NOT silently invent tenant/owner.
 * Ambiguous identity → typed incompatibility result.
 */

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_DEFINITION_STATUS,
  COMPETITION_OWNER_TYPE,
  COMPETITION_DEFINITION_INITIAL_REVISION,
  isCompetitionType,
} from "../constants/index.js";
import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import { validateCompetitionDefinitionInput } from "../contracts/definition.js";
import {
  createFieldError,
  validationFail,
  validationOk,
  snapshotInput,
} from "../contracts/validation.js";
import { isNonEmptyString, isValidTimestamp } from "../contracts/shared.js";

/**
 * Map legacy TOURNAMENT_STATUS → CM-01 management status (read projection only).
 * Cancelled / unknown without a safe mapping → incompatible.
 * @param {unknown} legacyStatus
 * @returns {{ status?: string, error?: import("../contracts/validation.js").CompetitionDefinitionFieldError }}
 */
function mapLegacyStatus(legacyStatus) {
  const raw = String(legacyStatus || "").trim().toLowerCase();
  if (raw === "draft") {
    return { status: COMPETITION_DEFINITION_STATUS.DRAFT };
  }
  if (
    raw === "registration" ||
    raw === "ready" ||
    raw === "active" ||
    raw === "completed"
  ) {
    return { status: COMPETITION_DEFINITION_STATUS.PUBLISHED };
  }
  if (raw === "cancelled") {
    return {
      error: createFieldError(
        "status",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy cancelled status maps to CM-07 ownership; not projected by CM-01",
        { legacyStatus: raw }
      ),
    };
  }
  return {
    error: createFieldError(
      "status",
      COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
      "legacy tournament status cannot be mapped safely",
      { legacyStatus }
    ),
  };
}

/**
 * Project a legacy tournament-like object to CompetitionDefinition.
 *
 * Required for success:
 * - explicit id (or competitionId) — ambiguous dual ids with mismatch → reject
 * - explicit tenantId — never inferred from DEFAULT_TENANT / first club
 * - explicit organizer/owner via options.owner (legacy blob lacks canonical owner)
 * - non-empty name
 * - mode in COMPETITION_TYPE allowlist
 * - clubId when projecting as club-scoped (default scope=club)
 *
 * @param {object} legacyTournament
 * @param {{
 *   owner: { ownerId: string, ownerType: string },
 *   visibility?: string,
 *   scope?: string,
 *   createdAt?: string|number,
 *   updatedAt?: string|number,
 *   template?: object|null,
 *   ruleSet?: object|null,
 * }} options
 * @returns {import("../contracts/validation.js").CompetitionDefinitionValidationResult}
 */
export function projectLegacyTournamentToCompetitionDefinition(
  legacyTournament,
  options = {}
) {
  const legacySnapshot = snapshotInput(legacyTournament);
  void legacySnapshot;

  /** @type {import("../contracts/validation.js").CompetitionDefinitionFieldError[]} */
  const errors = [];

  if (!legacyTournament || typeof legacyTournament !== "object") {
    return validationFail([
      createFieldError(
        "legacyTournament",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy tournament object is required",
        {}
      ),
    ]);
  }

  const src = /** @type {Record<string, unknown>} */ (legacyTournament);

  // Ambiguous identity: both ids present and differ.
  if (
    isNonEmptyString(src.id) &&
    isNonEmptyString(src.competitionId) &&
    String(src.id).trim() !== String(src.competitionId).trim()
  ) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "ambiguous identity: id and competitionId differ",
        { id: src.id, competitionId: src.competitionId }
      )
    );
  }

  const competitionId = isNonEmptyString(src.competitionId)
    ? String(src.competitionId).trim()
    : isNonEmptyString(src.id)
      ? String(src.id).trim()
      : null;

  if (!competitionId) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy tournament lacks id/competitionId",
        {}
      )
    );
  }

  if (!isNonEmptyString(src.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy tournament lacks explicit tenantId; CM-01 will not infer tenant",
        {}
      )
    );
  }

  if (!options.owner || typeof options.owner !== "object") {
    errors.push(
      createFieldError(
        "owner",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "explicit owner must be supplied in projector options; not inferred from legacy blob",
        {}
      )
    );
  }

  if (!isNonEmptyString(src.name)) {
    errors.push(
      createFieldError(
        "name",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy tournament name is empty; refusing silent default name",
        {}
      )
    );
  }

  const mode = isNonEmptyString(src.mode) ? String(src.mode).trim() : null;
  if (!mode || !isCompetitionType(mode)) {
    errors.push(
      createFieldError(
        "competitionType",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy mode is missing or not in CM-01 competition type allowlist",
        { mode, allowed: Object.values(COMPETITION_TYPE) }
      )
    );
  }

  const statusMapped = mapLegacyStatus(src.status);
  if (statusMapped.error) errors.push(statusMapped.error);

  const scope =
    options.scope == null ? COMPETITION_SCOPE.CLUB : options.scope;
  const visibility =
    options.visibility == null
      ? COMPETITION_VISIBILITY.PRIVATE
      : options.visibility;

  /** @type {object[]} */
  const clubs = [];
  if (scope === COMPETITION_SCOPE.CLUB || scope === COMPETITION_SCOPE.MULTI_CLUB) {
    if (!isNonEmptyString(src.clubId)) {
      errors.push(
        createFieldError(
          "clubs",
          COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
          "legacy clubId required for club-scoped projection",
          { scope }
        )
      );
    } else {
      clubs.push({ clubId: String(src.clubId).trim() });
    }
  }

  // Registration window from settings.registration when both bounds present; else omit.
  let registrationWindow = null;
  const reg =
    src.settings &&
    typeof src.settings === "object" &&
    /** @type {Record<string, unknown>} */ (src.settings).registration &&
    typeof /** @type {Record<string, unknown>} */ (src.settings).registration ===
      "object"
      ? /** @type {Record<string, unknown>} */ (
          /** @type {Record<string, unknown>} */ (src.settings).registration
        )
      : null;
  if (reg) {
    if (isValidTimestamp(reg.opensAt) && isValidTimestamp(reg.closesAt)) {
      registrationWindow = { opensAt: reg.opensAt, closesAt: reg.closesAt };
    } else if (reg.opensAt != null || reg.closesAt != null) {
      errors.push(
        createFieldError(
          "registrationWindow",
          COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
          "partial registration window in legacy settings is ambiguous",
          { opensAt: reg.opensAt, closesAt: reg.closesAt }
        )
      );
    }
  }

  const createdAt =
    options.createdAt ??
    (isValidTimestamp(src.createdAt) ? src.createdAt : null);
  const updatedAt =
    options.updatedAt ??
    (isValidTimestamp(src.updatedAt)
      ? src.updatedAt
      : isValidTimestamp(src.createdAt)
        ? src.createdAt
        : null);

  if (!isValidTimestamp(createdAt) || !isValidTimestamp(updatedAt)) {
    errors.push(
      createFieldError(
        "createdAt",
        COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE,
        "legacy timestamps missing; supply createdAt/updatedAt in options",
        {}
      )
    );
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  const candidate = {
    competitionId,
    tenantId: String(src.tenantId).trim(),
    owner: options.owner,
    name: String(src.name).trim(),
    description:
      typeof src.description === "string" ? src.description : "",
    competitionType: mode,
    scope,
    visibility,
    status: statusMapped.status,
    revision: COMPETITION_DEFINITION_INITIAL_REVISION,
    venues: [],
    clubs,
    registrationWindow,
    plannedPeriod: null,
    template: options.template ?? null,
    ruleSet: options.ruleSet ?? null,
    createdAt,
    updatedAt,
  };

  const validated = validateCompetitionDefinitionInput(candidate);
  if (!validated.ok) return validated;

  return validationOk(validated.value, {
    summary: "Legacy tournament projected to CompetitionDefinition.",
    reasons: Object.freeze([
      "source=legacy_tournament",
      "read_compatibility_only",
      `assumedVisibility=${visibility === COMPETITION_VISIBILITY.PRIVATE && options.visibility == null}`,
      `ownerType=${options.owner?.ownerType ?? COMPETITION_OWNER_TYPE.USER}`,
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyProjectionResult(value) {
  return Boolean(value) && typeof value === "object" && "ok" in /** @type {object} */ (value);
}

export const LEGACY_TOURNAMENT_COMPATIBILITY = Object.freeze({
  canonicalSourceOfTruth: "CompetitionDefinition (CM-01) — dormant until wired",
  transitionalSourceOfTruth:
    "club_data_v3.tournaments[] via tournamentService (production today)",
  legacySource: "src/models/tournament/tournament.js normalizeTournament",
  readCompatibility: "projectLegacyTournamentToCompetitionDefinition",
  writeCompatibility: "deferred — CM-01 does not write legacy blobs",
  deferredMigration: "no SQL migration in CM-01; cutover requires Integrator phase",
});
