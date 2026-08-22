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
import { createOfficialOpenAdapterB } from "../../tournament/official-open-adapter-b/createOfficialOpenAdapterB.js";
import { shouldActivateOfficialOpenRating } from "../../tournament/official-open-adapter-b/activation.js";
import { resolveOfficialRegistrationEligibilityRules } from "./officialContentCompetitionRules.js";

function isOfficialTournament(tournament) {
  return (
    String(tournament?.mode || "") === "official_tournament" ||
    Boolean(tournament?.officialMode)
  );
}

function withOfficialOpenAuditSink(tournament, options = {}) {
  if (!isOfficialTournament(tournament) || typeof options.appendAudit === "function") {
    return options;
  }
  const adapter = createOfficialOpenAdapterB({
    tournament,
    currentTenantId: options.tenantId || tournament?.tenantId,
    actor: options.actor,
  });
  return {
    ...options,
    appendAudit: (payload) =>
      adapter.appendAudit(payload.action, {
        actorId: payload.actor?.id,
        clubId: payload.clubId,
        entityRef: payload.resourceId,
      }),
  };
}

function resolveEligibilityOptions(tournament, options = {}) {
  const eventId = String(options.eventId || "").trim();
  const isOfficial = isOfficialTournament(tournament);

  if (!isOfficial) {
    return {
      ok: true,
      eligibilityOptions: {
        ...options,
        eventId: eventId || options.eventId,
      },
    };
  }

  const resolved = resolveOfficialRegistrationEligibilityRules(tournament, {
    eventId: eventId || undefined,
    allowSoleEventInference: !eventId && (tournament?.events || []).length === 1,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      code: resolved.code || "EVENT_REQUIRED",
      violations:
        resolved.code === "INVALID_ELIGIBILITY_POLICY"
          ? [
              {
                code: ELIGIBILITY_VIOLATION.INVALID_ELIGIBILITY_POLICY,
                message: resolved.error,
              },
            ]
          : [],
    };
  }

  return {
    ok: true,
    eligibilityOptions: {
      ...options,
      eventId: resolved.eventId,
      rules: resolved.rules,
      requireCanonicalMembershipEvidence:
        options.requireCanonicalMembershipEvidence === true ||
        resolved.rules.clubMembership?.enabled === true,
      requireCanonicalRatingEvidence:
        options.requireCanonicalRatingEvidence === true ||
        (resolved.hasRatingBounds === true &&
          shouldActivateOfficialOpenRating(tournament, { eventId: resolved.eventId })),
      eligibilitySource: resolved.source,
      skillRatingAuthority: resolved.skillRatingAuthority,
    },
  };
}

export function validateRegistrationEligibility(tournament, playerIds, players = [], options = {}) {
  const scoped = resolveEligibilityOptions(tournament, options);
  if (!scoped.ok) {
    const policy = getRegistrationPolicy(tournament);
    return {
      ok: false,
      violations: scoped.violations || [],
      message: scoped.error || policy.eligibilityFailedMessage,
      code: scoped.code,
    };
  }

  const report = checkEntryPlayersEligibility(
    tournament,
    playerIds,
    players,
    scoped.eligibilityOptions
  );
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
    eligibilitySource: scoped.eligibilityOptions.eligibilitySource || null,
    message: report.ok
      ? ""
      : report.violations[0]?.message || policy.eligibilityFailedMessage,
  };
}

export function gatedSubmitRegistration(tournament, payload = {}, options = {}) {
  const playerIds = payload.playerIds || [];
  const events = tournament.events || [];
  const wanted = String(payload.eventId || "").trim();
  const isOfficial = isOfficialTournament(tournament);

  if (isOfficial && !wanted && events.length > 1) {
    return {
      ok: false,
      error: "Chọn nội dung tường minh (eventId) trước khi đăng ký.",
      code: "EVENT_REQUIRED",
      tournament,
    };
  }

  const event =
    (wanted
      ? events.find((item) => String(item.id) === wanted)
      : null) ||
    (events.length === 1 ? events[0] : null) ||
    (!isOfficial ? events[0] : null);

  if (isOfficial && !event) {
    return {
      ok: false,
      error: "Giải chưa có nội dung thi đấu.",
      code: wanted ? "EVENT_NOT_FOUND" : "EVENT_REQUIRED",
      tournament,
    };
  }

  const eventId = wanted || (event ? String(event.id) : "");

  const eligibility = validateRegistrationEligibility(tournament, playerIds, options.players || [], {
    eventId,
    event,
    clubId: options.clubId || tournament.clubId,
    hasInvite: Boolean(options.hasInvite),
    excludeEntryId: options.excludeEntryId,
    membershipEvidence: options.membershipEvidence,
    membershipEvidenceByPlayerId: options.membershipEvidenceByPlayerId,
    ratingEvidence: options.ratingEvidence,
    ratingEvidenceByPlayerId: options.ratingEvidenceByPlayerId,
  });

  let working = tournament;
  const audited = auditEligibilityDecision(
    working,
    {
      ok: eligibility.ok,
      playerIds,
      violations: eligibility.violations,
    },
    withOfficialOpenAuditSink(tournament, options)
  );
  working = audited.tournament;

  if (!eligibility.ok) {
    return {
      ok: false,
      error: eligibility.message,
      code: eligibility.code || "ELIGIBILITY_FAILED",
      violations: eligibility.violations,
      tournament: working,
    };
  }

  const result = submitRegistration(
    working,
    {
      ...payload,
      eventId: eventId || payload.eventId,
    },
    options
  );
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
      eventId: options.eventId,
      clubId: options.clubId || tournament.clubId,
      hasInvite: true,
      membershipEvidence: options.membershipEvidence,
      ratingEvidence: options.ratingEvidence,
    }
  );

  let working = auditEligibilityDecision(
    tournament,
    { ok: eligibility.ok, playerIds: [partnerPlayerId], violations: eligibility.violations },
    withOfficialOpenAuditSink(tournament, options)
  ).tournament;

  if (!eligibility.ok) {
    return {
      ok: false,
      error: eligibility.message,
      code: eligibility.code || "ELIGIBILITY_FAILED",
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
        membershipEvidence: options.membershipEvidence,
        membershipEvidenceByPlayerId: options.membershipEvidenceByPlayerId,
        ratingEvidence: options.ratingEvidence,
        ratingEvidenceByPlayerId: options.ratingEvidenceByPlayerId,
      }
    );
    if (!eligibility.ok) {
      return {
        ok: false,
        error: eligibility.message,
        code: eligibility.code || "ELIGIBILITY_FAILED",
        violations: eligibility.violations,
      };
    }
  }

  return approveEntry(tournament, entryId, {
    ...options,
    eventId: options.eventId || event?.id,
  });
}

export function gatedPromoteFromWaitlist(tournament, options = {}) {
  const queueEvent =
    (tournament.events || []).find((item) => String(item.id) === String(options.eventId)) ||
    ((tournament.events || []).length === 1 ? tournament.events[0] : null);
  if (!queueEvent && isOfficialTournament(tournament) && (tournament.events || []).length > 1) {
    return {
      ok: false,
      error: "Chọn nội dung tường minh (eventId) trước khi duyệt danh sách chờ.",
      code: "EVENT_REQUIRED",
    };
  }
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

  return promoteFromWaitlist(tournament, {
    ...options,
    eventId: options.eventId || queueEvent?.id,
  });
}
