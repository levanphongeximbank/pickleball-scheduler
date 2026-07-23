import {
  createAuthorizationRequest,
  isPlainObject,
  optionalNonEmptyString,
} from "../contracts/index.js";
import { COMPETITION_ACTION } from "../enums/competitionActions.js";
import { AUTHORIZATION_DENY_REASON } from "../enums/denyReasons.js";
import { evaluateAuthorization } from "../services/evaluateAuthorization.js";
import { createUnavailableIdentityEvidencePort } from "../ports/identityEvidencePort.js";

const TEAM_ACTIONS = new Set([
  COMPETITION_ACTION.TEAM_ROSTER_UNLOCK,
  COMPETITION_ACTION.TEAM_WITHDRAW,
  COMPETITION_ACTION.TEAM_ACTIVATE,
  COMPETITION_ACTION.ROSTER_LOCK,
]);

/**
 * Implements Team `TeamAuthorizationAdapter` via CORE-02 evaluateAuthorization.
 * Lives in CORE-02 — no Team core edits required.
 *
 * @param {{
 *   evidencePort?: unknown,
 *   defaultCompetitionId?: string|null,
 * }} [options]
 * @returns {{ authorize: Function }}
 */
export function createTeamAuthorizationPortAdapter(options = {}) {
  const evidencePort =
    options.evidencePort || createUnavailableIdentityEvidencePort();

  return {
    /**
     * @param {{
     *   action?: string,
     *   actor?: string|null,
     *   team?: unknown,
     *   roster?: unknown,
     *   context?: Record<string, unknown>,
     * }} request
     */
    async authorize(request = {}) {
      const action = String(request?.action || "");
      if (!TEAM_ACTIONS.has(action)) {
        return {
          allowed: false,
          reason: `Unknown team authorization action: ${action}`,
        };
      }

      const context = isPlainObject(request.context) ? request.context : {};
      const team = isPlainObject(request.team) ? request.team : {};
      const competitionId =
        optionalNonEmptyString(context.competitionId) ||
        optionalNonEmptyString(team.competitionId) ||
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
            actorId: optionalNonEmptyString(request.actor),
            role:
              optionalNonEmptyString(context.actorRole) ||
              optionalNonEmptyString(context.role),
          },
          scope: {
            tenantId: optionalNonEmptyString(context.tenantId),
            venueId: optionalNonEmptyString(context.venueId),
            clubId: optionalNonEmptyString(context.clubId),
            competitionId,
            divisionId: optionalNonEmptyString(context.divisionId),
            teamId:
              optionalNonEmptyString(context.teamId) ||
              optionalNonEmptyString(team.id) ||
              optionalNonEmptyString(team.teamId),
            matchId: optionalNonEmptyString(context.matchId),
          },
          context,
          metadata: { adapter: "teamAuthorizationPortAdapter" },
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
