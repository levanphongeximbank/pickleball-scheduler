import {
  createAuthorizationRequest,
  isPlainObject,
  optionalNonEmptyString,
} from "../contracts/index.js";
import { COMPETITION_ACTION } from "../enums/competitionActions.js";
import { AUTHORIZATION_DENY_REASON } from "../enums/denyReasons.js";
import { evaluateAuthorization } from "../services/evaluateAuthorization.js";
import { createUnavailableIdentityEvidencePort } from "../ports/identityEvidencePort.js";

const LINEUP_ACTIONS = new Set([
  COMPETITION_ACTION.LINEUP_DRAFT,
  COMPETITION_ACTION.LINEUP_SUBMIT,
  COMPETITION_ACTION.LINEUP_LOCK,
  COMPETITION_ACTION.LINEUP_PUBLISH,
  COMPETITION_ACTION.LINEUP_OVERRIDE,
  COMPETITION_ACTION.LINEUP_VOID,
  COMPETITION_ACTION.LINEUP_VIEW_OWN,
  COMPETITION_ACTION.LINEUP_VIEW_OPPONENT,
]);

/**
 * Implements Lineup `LineupAuthorizationPort` via CORE-02 evaluateAuthorization.
 *
 * @param {{
 *   evidencePort?: unknown,
 *   defaultCompetitionId?: string|null,
 * }} [options]
 * @returns {{ authorize: Function }}
 */
export function createLineupAuthorizationPortAdapter(options = {}) {
  const evidencePort =
    options.evidencePort || createUnavailableIdentityEvidencePort();

  return {
    /**
     * @param {{
     *   action?: string,
     *   actorId?: string|null,
     *   actorRole?: string|null,
     *   lineup?: unknown,
     *   context?: Record<string, unknown>,
     * }} request
     */
    async authorize(request = {}) {
      const action = String(request?.action || "");
      if (!LINEUP_ACTIONS.has(action)) {
        return {
          allowed: false,
          reason: `Unknown lineup authorization action: ${action}`,
        };
      }

      const context = isPlainObject(request.context) ? request.context : {};
      const lineup = isPlainObject(request.lineup) ? request.lineup : {};
      const competitionId =
        optionalNonEmptyString(context.competitionId) ||
        optionalNonEmptyString(lineup.competitionId) ||
        optionalNonEmptyString(options.defaultCompetitionId);

      if (!competitionId) {
        return {
          allowed: false,
          reason: AUTHORIZATION_DENY_REASON.MISSING_SCOPE,
        };
      }

      const decision = await evaluateAuthorization(
        createAuthorizationRequest({
          action,
          subject: {
            actorId: optionalNonEmptyString(request.actorId),
            role:
              optionalNonEmptyString(request.actorRole) ||
              optionalNonEmptyString(context.actorRole),
          },
          scope: {
            tenantId: optionalNonEmptyString(context.tenantId),
            venueId: optionalNonEmptyString(context.venueId),
            clubId: optionalNonEmptyString(context.clubId),
            competitionId,
            divisionId: optionalNonEmptyString(context.divisionId),
            teamId:
              optionalNonEmptyString(context.teamId) ||
              optionalNonEmptyString(lineup.teamId),
            matchId:
              optionalNonEmptyString(context.matchId) ||
              optionalNonEmptyString(lineup.matchId) ||
              optionalNonEmptyString(lineup.contextId),
          },
          context,
          metadata: { adapter: "lineupAuthorizationPortAdapter" },
        }),
        { evidencePort }
      );

      return {
        allowed: decision.allowed === true,
        reason: decision.allowed
          ? null
          : decision.reason || decision.denyReason,
      };
    },
  };
}
