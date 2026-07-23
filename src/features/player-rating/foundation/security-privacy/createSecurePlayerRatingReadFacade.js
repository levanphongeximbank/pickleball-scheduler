/**
 * Secure read wrapper around Phase 1H Player Rating read facade (Phase 1I).
 * Projection occurs after read-model collection. No write API.
 */

import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  isNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { authorizePlayerRatingRead } from "./authorizePlayerRatingRead.js";
import { createPlayerRatingPrivacyPolicy } from "./createPlayerRatingPrivacyPolicy.js";
import { PLAYER_RATING_PRIVACY_PROJECTION_LEVEL } from "./privacyProjectionLevels.js";
import { projectPublicPlayerRating } from "./projectPublicPlayerRating.js";
import { projectRestrictedPlayerRating } from "./projectRestrictedPlayerRating.js";
import {
  PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE,
  failSecurityPrivacy,
} from "./securityPrivacyErrors.js";

/**
 * @param {unknown} readFacade
 */
function requireOverviewReader(readFacade) {
  if (
    !readFacade ||
    typeof readFacade !== "object" ||
    typeof /** @type {{ getPlayerRatingOverview?: unknown }} */ (readFacade)
      .getPlayerRatingOverview !== "function"
  ) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "createSecurePlayerRatingReadFacade requires a Phase 1H readFacade"
    );
  }
}

/**
 * @param {unknown} input
 * @param {unknown} accessContext
 * @param {string} expectedProjectionLevel
 * @param {string} subjectPlayerId
 */
function assertSubjectAlignment(input, accessContext, expectedProjectionLevel, subjectPlayerId) {
  const raw =
    input && typeof input === "object"
      ? /** @type {Record<string, unknown>} */ (input)
      : {};
  if (isNonEmptyString(raw.playerId) && String(raw.playerId).trim() !== subjectPlayerId) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_SUBJECT_MISMATCH,
      "Request playerId does not match access subjectPlayerId",
      { subjectPlayerId, reasonCode: "REQUEST_SUBJECT_MISMATCH" }
    );
  }

  const ctx =
    accessContext && typeof accessContext === "object"
      ? /** @type {Record<string, unknown>} */ (accessContext)
      : {};
  if (
    isNonEmptyString(ctx.projectionLevel) &&
    String(ctx.projectionLevel) !== expectedProjectionLevel
  ) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
      "Access context projectionLevel does not match secure read method",
      { projectionLevel: String(ctx.projectionLevel) }
    );
  }
}

/**
 * @param {{
 *   readFacade: { getPlayerRatingOverview: Function },
 *   privacyPolicy?: ReturnType<typeof createPlayerRatingPrivacyPolicy>,
 * }} deps
 */
export function createSecurePlayerRatingReadFacade(deps) {
  if (!deps || typeof deps !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "createSecurePlayerRatingReadFacade requires a dependency object"
    );
  }

  requireOverviewReader(deps.readFacade);
  const readFacade = deps.readFacade;
  const privacyPolicy =
    deps.privacyPolicy || createPlayerRatingPrivacyPolicy();

  /**
   * @param {unknown} input
   * @param {unknown} accessContext
   * @param {string} projectionLevel
   */
  async function readAndProject(input, accessContext, projectionLevel) {
    if (accessContext == null) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_READ_UNAUTHORIZED,
        "Secure rating read requires access context"
      );
    }

    if (!input || typeof input !== "object") {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
        "Secure rating read requires an overview input object"
      );
    }

    const raw = /** @type {Record<string, unknown>} */ (input);
    const scope = requireExplicitPlayerRatingScope(raw.scope);
    const subjectPlayerId = requireNonEmptyString(
      /** @type {Record<string, unknown>} */ (accessContext).subjectPlayerId,
      "subjectPlayerId"
    );

    assertSubjectAlignment(input, accessContext, projectionLevel, subjectPlayerId);

    authorizePlayerRatingRead(
      {
        .../** @type {Record<string, unknown>} */ (accessContext),
        projectionLevel,
      },
      {
        subjectScope: scope,
        expectedProjectionLevel: projectionLevel,
      }
    );

    // Ensure overview is collected for the authorized subject only.
    const overviewInput = {
      ...raw,
      playerId: subjectPlayerId,
      scope,
    };

    const overview = await readFacade.getPlayerRatingOverview(overviewInput);

    if (
      overview &&
      typeof overview === "object" &&
      isNonEmptyString(/** @type {{ playerId?: unknown }} */ (overview).playerId) &&
      String(/** @type {{ playerId: string }} */ (overview).playerId) !==
        subjectPlayerId
    ) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_SUBJECT_MISMATCH,
        "Overview playerId does not match authorized subject",
        { subjectPlayerId, reasonCode: "OVERVIEW_SUBJECT_MISMATCH" }
      );
    }

    if (projectionLevel === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC) {
      return projectPublicPlayerRating(overview, {
        privacyPolicy,
        kind: "overview",
      });
    }

    return projectRestrictedPlayerRating(overview, {
      projectionLevel,
      privacyPolicy,
      kind: "overview",
    });
  }

  return Object.freeze({
    getPublicOverview(input, accessContext) {
      return readAndProject(
        input,
        accessContext,
        PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC
      );
    },
    getSelfOverview(input, accessContext) {
      return readAndProject(
        input,
        accessContext,
        PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF
      );
    },
    getReviewerOverview(input, accessContext) {
      return readAndProject(
        input,
        accessContext,
        PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER
      );
    },
    getInternalOverview(input, accessContext) {
      return readAndProject(
        input,
        accessContext,
        PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM
      );
    },
  });
}
