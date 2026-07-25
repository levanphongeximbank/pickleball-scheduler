/**
 * Production ClubMembershipReader — reads Club SoT (club_members + governance).
 * Communication never mutates Club membership tables.
 */

import { CLUB_MEMBERSHIP_STATUS } from "../constants/clubMembershipStatus.js";
import { createClubMembershipFactContract } from "../contracts/clubMembershipFact.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { matchesClubMembershipReader } from "../ports/clubMembershipReaderPort.js";

const MANAGER_ROLE_CODES = Object.freeze([
  "club_owner",
  "president",
  "vice_president",
]);

/**
 * @param {string|null|undefined} status
 */
function mapMembershipStatus(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "active") return CLUB_MEMBERSHIP_STATUS.ACTIVE;
  if (raw === "suspended") return CLUB_MEMBERSHIP_STATUS.SUSPENDED;
  if (raw === "removed" || raw === "left") return CLUB_MEMBERSHIP_STATUS.REMOVED;
  return CLUB_MEMBERSHIP_STATUS.NOT_MEMBER;
}

/**
 * @param {object} client — injected privileged or trusted client (server-only)
 * @param {object} [options]
 */
export function createSupabaseClubMembershipReader(client, options = {}) {
  if (!client || typeof client.from !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Club membership reader requires an injected Supabase client",
      {}
    );
  }

  const includeGovernance = options.includeGovernance !== false;

  const reader = {
    /**
     * @param {string} clubId
     * @param {string} participantId — auth user id from verified JWT
     */
    async getMembership(clubId, participantId) {
      const club = String(clubId || "").trim();
      const userId = String(participantId || "").trim();
      if (!club || !userId) {
        return createClubMembershipFactContract({
          clubId: club || "unknown",
          participantId: userId || "unknown",
          status: CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
          externalRoleFacts: null,
        });
      }

      const { data: member, error } = await client
        .from("club_members")
        .select("id, club_id, user_id, status, membership_type, tenant_id")
        .eq("club_id", club)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
          "Club membership lookup failed — fail-closed",
          { clubId: club, participantId: userId }
        );
      }

      if (!member) {
        return createClubMembershipFactContract({
          clubId: club,
          participantId: userId,
          status: CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
          externalRoleFacts: null,
        });
      }

      /** @type {string[]} */
      const governanceRoles = [];
      if (includeGovernance && member.id) {
        const { data: govRows, error: govError } = await client
          .from("club_governance_assignments")
          .select("role_code, status")
          .eq("club_id", club)
          .eq("club_member_id", member.id)
          .eq("status", "active");
        if (govError) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
            "Club governance lookup failed — fail-closed",
            { clubId: club, participantId: userId }
          );
        }
        for (const row of govRows || []) {
          const code = String(row.role_code || "").trim();
          if (MANAGER_ROLE_CODES.includes(code)) governanceRoles.push(code);
        }
      }

      const membershipType = String(member.membership_type || "").toLowerCase();
      const isManagerType =
        membershipType === "manager" || membershipType === "owner";

      const externalRoleFacts = Object.freeze({
        membershipType: member.membership_type || null,
        tenantId: member.tenant_id || null,
        clubRoles: Object.freeze([...governanceRoles]),
        isClubManagerOrOwner:
          governanceRoles.length > 0 || isManagerType === true,
      });

      return createClubMembershipFactContract({
        clubId: club,
        participantId: userId,
        status: mapMembershipStatus(member.status),
        externalRoleFacts,
      });
    },

    async isActiveMember(clubId, participantId) {
      const fact = await this.getMembership(clubId, participantId);
      return fact.status === CLUB_MEMBERSHIP_STATUS.ACTIVE;
    },
  };

  if (!matchesClubMembershipReader(reader)) {
    throw new Error("createSupabaseClubMembershipReader missing port methods");
  }

  return Object.freeze(reader);
}

export { MANAGER_ROLE_CODES };
