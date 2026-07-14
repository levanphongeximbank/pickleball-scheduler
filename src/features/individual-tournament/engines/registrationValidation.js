/**
 * S1-C registration gate — wraps S1-B APIs without modifying registrationEngine.js
 */
import { validateEntryForEvent } from "../../../tournament/engines/validationEngine.js";
import {
  auditEligibilityDecision,
  checkEntryPlayersEligibility,
  ELIGIBILITY_VIOLATION,
} from "./eligibilityEngine.js";
import { canApproveWithFee } from "./entryFeeEngine.js";
import { getRegistrationPolicy } from "./regulationsEngine.js";
import {
  approveEntry,
  confirmPartnerInvite,
  promoteFromWaitlist,
  submitRegistration,
} from "./registrationEngine.js";

export function validateRegistrationEligibility(tournament, playerIds, players = [], options = {}) {
  const report = checkEntryPlayersEligibility(tournament, playerIds, players, options);
  const policy = getRegistrationPolicy(tournament);

  // Event-type gender via shared validation when entry has full roster
  if (options.event && options.event.eventType && playerIds.length > 0) {
    const genderCheck = validateEntryForEvent(
      { id: "probe", name: "probe", playerIds },
      players,
      options.event.eventType
    );
    // Ignore "need N players" during partner-invite partial submit
    const genderOnlyErrors = (genderCheck.errors || []).filter(
      (message) => !/can \d+ VDV/i.test(message) && !/cần \d+ VĐV/i.test(message)
    );
    if (genderOnlyErrors.length > 0) {
      report.ok = false;
      report.violations.push({
        code: ELIGIBILITY_VIOLATION.GENDER_NOT_ALLOWED,
        message: genderOnlyErrors.join(" "),
      });
    }
  }

  return {
    ...report,
    message: report.ok
      ? ""
      : report.violations[0]?.message || policy.eligibilityFailedMessage,
  };
}

export function gatedSubmitRegistration(tournament, payload = {}, options = {}) {
  const playerIds = payload.playerIds || [];
  const event =
    (tournament.events || []).find((item) => String(item.id) === String(payload.eventId)) ||
    tournament.events?.[0];

  const eligibility = validateRegistrationEligibility(tournament, playerIds, options.players || [], {
    eventId: payload.eventId || event?.id,
    event,
    clubId: options.clubId || tournament.clubId,
    hasInvite: Boolean(options.hasInvite),
    excludeEntryId: options.excludeEntryId,
  });

  let working = tournament;
  const audited = auditEligibilityDecision(
    working,
    {
      ok: eligibility.ok,
      playerIds,
      violations: eligibility.violations,
    },
    options
  );
  working = audited.tournament;

  if (!eligibility.ok) {
    return {
      ok: false,
      error: eligibility.message,
      code: "ELIGIBILITY_FAILED",
      violations: eligibility.violations,
      tournament: working,
    };
  }

  const result = submitRegistration(working, payload, options);
  if (!result.ok) {
    return { ...result, tournament: result.tournament || working };
  }

  return {
    ...result,
    tournament: {
      ...result.tournament,
      settings: {
        ...working.settings,
        ...result.tournament.settings,
        eligibilityAuditLog: working.settings?.eligibilityAuditLog,
      },
    },
  };
}

export function gatedConfirmPartnerInvite(tournament, token, partnerPlayerId, options = {}) {
  const eligibility = validateRegistrationEligibility(
    tournament,
    [partnerPlayerId],
    options.players || [],
    {
      clubId: options.clubId || tournament.clubId,
      hasInvite: true,
    }
  );

  let working = auditEligibilityDecision(
    tournament,
    { ok: eligibility.ok, playerIds: [partnerPlayerId], violations: eligibility.violations },
    options
  ).tournament;

  if (!eligibility.ok) {
    return {
      ok: false,
      error: eligibility.message,
      code: "ELIGIBILITY_FAILED",
      violations: eligibility.violations,
      tournament: working,
    };
  }

  return confirmPartnerInvite(working, token, partnerPlayerId, options);
}

export function gatedApproveEntry(tournament, entryId, options = {}) {
  const feeGate = canApproveWithFee(tournament, entryId);
  if (!feeGate.ok) {
    return feeGate;
  }

  const event =
    (tournament.events || []).find((item) => String(item.id) === String(options.eventId)) ||
    (tournament.events || []).find((item) =>
      (item.entries || []).some((entry) => String(entry.id) === String(entryId))
    );

  const entry = (event?.entries || []).find((item) => String(item.id) === String(entryId));
  if (entry && options.players) {
    const eligibility = validateRegistrationEligibility(
      tournament,
      entry.playerIds || [],
      options.players,
      {
        eventId: event?.id,
        event,
        clubId: options.clubId || tournament.clubId,
        excludeEntryId: entryId,
      }
    );
    if (!eligibility.ok) {
      return {
        ok: false,
        error: eligibility.message,
        code: "ELIGIBILITY_FAILED",
        violations: eligibility.violations,
      };
    }
  }

  return approveEntry(tournament, entryId, options);
}

export function gatedPromoteFromWaitlist(tournament, options = {}) {
  const queueEvent =
    (tournament.events || []).find((item) => String(item.id) === String(options.eventId)) ||
    tournament.events?.[0];
  const waitlisted = (queueEvent?.entries || [])
    .filter((entry) => entry.status === "waitlisted")
    .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));
  const target = options.entryId
    ? waitlisted.find((entry) => String(entry.id) === String(options.entryId))
    : waitlisted[0];

  if (target) {
    const feeGate = canApproveWithFee(tournament, target.id);
    if (!feeGate.ok) {
      return feeGate;
    }
  }

  return promoteFromWaitlist(tournament, options);
}
