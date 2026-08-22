/**
 * Official/Internal projection helpers after authoritative CORE-13 assignment.
 * Blob fields are NEVER final authority — CORE-13 durable rows are.
 */

import {
  getRefereeSettings,
  findRefereeRosterEntry,
  findRosterEntryByCanonicalUserId,
} from "../../../models/tournament/refereeRoster.js";
import {
  REFEREE_ASSIGN_STATUS,
  getRefereeAssignments,
  normalizeAssignmentEntry,
} from "./refereeAssignEngine.js";
import { REFEREE_ROLE_CODE } from "../../competition-core/referee-assignment/index.js";

/**
 * Resolve CORE-13 referee identity from a roster option id or canonical id.
 * Rejects display-name / bare private roster ids without canonicalUserId.
 */
export function resolveCanonicalRefereeIdFromRoster(tournament, rosterOrCanonicalId) {
  const raw = String(rosterOrCanonicalId || "").trim();
  if (!raw) return { ok: true, refereeId: "", rosterEntry: null };

  const roster = getRefereeSettings(tournament).roster;
  const byCanonical = findRosterEntryByCanonicalUserId(roster, raw);
  if (byCanonical) {
    return {
      ok: true,
      refereeId: String(byCanonical.canonicalUserId || byCanonical.refereeUserId).trim(),
      rosterEntry: byCanonical,
    };
  }

  const byRosterId = findRefereeRosterEntry(roster, raw);
  if (byRosterId) {
    const canonical = String(
      byRosterId.canonicalUserId || byRosterId.refereeUserId || ""
    ).trim();
    if (!canonical) {
      return {
        ok: false,
        error: "Trọng tài chưa có danh tính canonical để phân công.",
        code: "CANONICAL_REFEREE_ID_REQUIRED",
      };
    }
    return { ok: true, refereeId: canonical, rosterEntry: byRosterId };
  }

  // Already a bare canonical id not present on roster — allow CORE-13 to validate.
  if (!/\s/.test(raw) && !raw.includes("@")) {
    return { ok: true, refereeId: raw, rosterEntry: null };
  }

  return {
    ok: false,
    error: "Không dùng display name làm identity phân công.",
    code: "DISPLAY_NAME_IDENTITY_DENIED",
  };
}

/**
 * Apply trusted-server result onto tournament blob as PROJECTION_ONLY.
 */
export function projectCore13AssignmentOntoTournament(
  tournament,
  { matchId, refereeId = "", rosterId = "", assignment = null, version = null } = {}
) {
  const current = tournament || {};
  const prev = current.settings?.core13RefereeAssignments || {
    byScope: {},
    versionByScope: {},
    audit: [],
    idempotency: {},
  };
  const key = `${String(matchId)}::${REFEREE_ROLE_CODE.PRIMARY}`;
  const byScope = { ...(prev.byScope || {}) };
  const versionByScope = { ...(prev.versionByScope || {}) };

  if (!refereeId) {
    delete byScope[key];
  } else if (assignment) {
    byScope[key] = {
      ...assignment,
      matchId: String(matchId),
      refereeId: String(refereeId),
      rosterId: String(rosterId || refereeId),
      status: "active",
    };
  } else {
    byScope[key] = {
      matchId: String(matchId),
      refereeId: String(refereeId),
      rosterId: String(rosterId || refereeId),
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      status: "active",
    };
  }
  if (version != null) versionByScope[key] = version;

  const roster = getRefereeSettings(current).roster;
  const entry =
    findRosterEntryByCanonicalUserId(roster, refereeId) ||
    (rosterId ? findRefereeRosterEntry(roster, rosterId) : null);

  const legacyMap = { ...getRefereeAssignments(current) };
  if (!refereeId) {
    delete legacyMap[String(matchId)];
  } else {
    legacyMap[String(matchId)] = normalizeAssignmentEntry(
      {
        matchId,
        rosterId: entry?.id || rosterId || refereeId,
        canonicalUserId: refereeId,
        refereeEmail: entry?.email || "",
        refereeName: entry?.name || assignment?.refereeDisplayName || refereeId,
        status: REFEREE_ASSIGN_STATUS.ASSIGNED,
        assignedAt: assignment?.assignedAt || new Date().toISOString(),
        assignedBy: assignment?.assignedBy || "",
        token: legacyMap[String(matchId)]?.token || "",
      },
      matchId
    );
  }

  return {
    ...current,
    settings: {
      ...(current.settings || {}),
      core13RefereeAssignments: {
        schema: "core13-blob-canonical-v1",
        interimUntilSqlGo: false,
        authority: false,
        projectionOnly: true,
        source: "trusted-server-projection",
        byScope,
        versionByScope,
        audit: prev.audit || [],
        idempotency: prev.idempotency || {},
      },
      // Compatibility projection for Official discovery RPC / denorm UI — NOT SSOT.
      refereeAssignments: legacyMap,
    },
  };
}
