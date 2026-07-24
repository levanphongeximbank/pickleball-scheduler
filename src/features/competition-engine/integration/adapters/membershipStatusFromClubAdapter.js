/**
 * INT-04 / BG-02 — Club → MembershipStatusPort adapter.
 *
 * Club owns membership. Competition only reads via injected lookup.
 * Fail-closed when club is required but missing / unresolvable.
 */

import { isClubMemberStatusActive } from "../../../club/constants/clubMemberRoles.js";
import { INTEGRATION_ERROR_CODE } from "../constants.js";
import { optionalNonEmptyString } from "../context/requireIntegrationContext.js";
import { normalizeAdapterError } from "../errors.js";

/**
 * @param {{
 *   getActiveMembershipForUser?: (clubId: string, participantId: string) => Promise<{
 *     ok?: boolean,
 *     data?: object|null,
 *     code?: string,
 *     message?: string,
 *   }|object|null>,
 *   isActiveStatus?: (status: unknown) => boolean,
 * }} [deps]
 * @returns {import('../../../competition-core/registration-eligibility/ports/membershipStatusPort.js').MembershipStatusPort}
 */
export function createMembershipStatusFromClubAdapter(deps = {}) {
  const getActiveMembershipForUser = deps.getActiveMembershipForUser;
  const isActive =
    typeof deps.isActiveStatus === "function"
      ? deps.isActiveStatus
      : isClubMemberStatusActive;

  return {
    async getMembershipStatus(args = {}) {
      const participantId = optionalNonEmptyString(args.participantId);
      const clubId = optionalNonEmptyString(args.clubId);
      const organizationId = optionalNonEmptyString(args.organizationId);

      if (!participantId) {
        return {
          isMember: false,
          status: null,
          reasonCodes: [INTEGRATION_ERROR_CODE.MISSING_IDENTITY],
        };
      }

      // Club-scoped eligibility requires clubId (organization alone is insufficient).
      if (!clubId) {
        return {
          isMember: false,
          status: null,
          reasonCodes: [
            organizationId
              ? INTEGRATION_ERROR_CODE.CLUB_MAPPING_MISSING
              : INTEGRATION_ERROR_CODE.MISSING_CLUB,
          ],
        };
      }

      if (typeof getActiveMembershipForUser !== "function") {
        return {
          isMember: false,
          status: null,
          reasonCodes: ["MEMBERSHIP_PORT_UNAVAILABLE"],
        };
      }

      try {
        const result = await getActiveMembershipForUser(clubId, participantId);
        // Support both repo result { ok, data } and direct membership row.
        let membership = null;
        if (result && typeof result === "object") {
          if ("ok" in result) {
            if (result.ok === false) {
              return {
                isMember: false,
                status: null,
                reasonCodes: [
                  result.code || INTEGRATION_ERROR_CODE.CLUB_MAPPING_MISSING,
                ],
              };
            }
            membership = result.data ?? null;
          } else {
            membership = result;
          }
        }

        if (!membership || typeof membership !== "object") {
          return {
            isMember: false,
            status: null,
            reasonCodes: [INTEGRATION_ERROR_CODE.CLUB_MAPPING_MISSING],
          };
        }

        const status =
          optionalNonEmptyString(membership.status) ||
          optionalNonEmptyString(membership.membershipStatus) ||
          null;
        const active = isActive(status);
        return {
          isMember: active,
          status,
          reasonCodes: active
            ? []
            : [INTEGRATION_ERROR_CODE.CLUB_MAPPING_MISSING],
        };
      } catch (err) {
        const normalized = normalizeAdapterError(
          err,
          INTEGRATION_ERROR_CODE.ADAPTER_FAILURE,
          "Club membership lookup failed"
        );
        return {
          isMember: false,
          status: null,
          reasonCodes: [normalized.code],
        };
      }
    },
  };
}
