/**
 * Wave O2 — Official experience command delegation.
 * Calls existing Official/Open engines only. Returns patches for
 * updateTournamentCommand / setTournamentStatusCommand. No new writers.
 */

import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import {
  buildIdentityPatch,
  buildAddOfficialEventPatch,
  buildUpdateEventPatch,
} from "../experience-a1/settingsWriters.js";
import {
  normalizeOfficialTournamentName,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_SCORING_METHOD,
  BEST_OF_3_OPERATIONAL,
  SIDEOUT_OPERATIONAL,
  parseOfficialDecimalLevelInput,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  patchEventContentCompetitionRules,
  resolveContentCompetitionRules,
  resolveContentGroup2Settings,
  resolveContentWildcardRequirement,
  CONTENT_RULES_SOURCE,
  CONTENT_COMPETITION_RULES_PROPERTY,
} from "../../individual-tournament/engines/officialContentCompetitionRules.js";
import { getRegistrationSettings } from "../../individual-tournament/engines/registrationEngine.js";
import {
  isRegistrationLocked,
  lockRegistration,
  setRegistrationWindow,
} from "../../individual-tournament/engines/registrationEngine.js";
import { gatedApproveEntry } from "../../individual-tournament/engines/registrationValidation.js";
import {
  formOfficialIndividualPairs,
  projectOfficialDrawSubsteps,
} from "../../individual-tournament/engines/officialDrawOrchestrationEngine.js";
import { OFFICIAL_PAIRING_AUTHORITY } from "../../individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  suggestOpenRandomEntriesFromPlayers,
  suggestBalancedEntriesFromIndividuals,
} from "../../../tournament/engines/teamPairingEngine.js";
import { resolveSelectedEvent, listTournamentEvents } from "../experience-a1/deriveOverview.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";
import {
  PAIR_FORMATION_MODE,
  resolveOfficialPairFormationMode,
} from "./pairFormationModeResolver.js";
import {
  resolveOfficialEffectiveCapability,
  createOfficialOpenCompetitionRulesSurface,
} from "../official-open-adapter-b/officialOpenCompetitionRules.js";
import { COMPETITION_RULES_CAPABILITY_ID } from "../../competition-core/competition-rules/index.js";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function tournamentPatchFrom(nextTournament, keys = []) {
  if (!nextTournament || typeof nextTournament !== "object") return {};
  const patch = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(nextTournament, key)) {
      patch[key] = nextTournament[key];
    }
  }
  return patch;
}

/**
 * Derive publication CTA state from existing registration/status domain.
 * Not a second publication authority.
 */
export function resolveOfficialRegistrationPublicationStatus(tournament) {
  const settings = getRegistrationSettings(tournament);
  if (settings.lockedAt || settings.closedAt) return "PUBLISHED";
  const status = String(tournament?.status || "");
  if (
    status === TOURNAMENT_STATUS.REGISTRATION ||
    status === TOURNAMENT_STATUS.READY ||
    status === TOURNAMENT_STATUS.ACTIVE ||
    status === TOURNAMENT_STATUS.COMPLETED
  ) {
    return "PUBLISHED";
  }
  if (settings.opensAt) return "PUBLISHED";
  return "NOT_PUBLISHED";
}

export function projectOfficialSettings(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const registration = getRegistrationSettings(tournament);
  // DISPLAY/READ sole-event compatibility: project settings for the only Content.
  // Does not mutate; multi-Content still requires selectedEventId.
  const eventId =
    trim(selectedEventId) ||
    (events.length === 1 ? String(events[0].id) : "");
  const contentResolved = eventId
    ? resolveContentCompetitionRules(tournament, {
        eventId,
        allowSoleEventInference: false,
      })
    : null;
  const rules = contentResolved?.ok ? contentResolved.rules : null;
  const group2 = eventId
    ? resolveContentGroup2Settings(tournament, {
        eventId,
        allowSoleEventInference: false,
      })
    : null;

  return {
    identity: {
      tournamentId: trim(tournament?.id),
      name: trim(tournament?.name),
      hostClubName: trim(tournament?.hostClubName),
      officialMode: tournament?.officialMode || null,
      status: trim(tournament?.status),
    },
    events: events.map((event) => ({
      id: String(event.id),
      name: String(event.name || ""),
      eventType: event.eventType || "",
      hasExplicitContentRules: Boolean(
        event?.[CONTENT_COMPETITION_RULES_PROPERTY] &&
          typeof event[CONTENT_COMPETITION_RULES_PROPERTY] === "object"
      ),
    })),
    selectedEventId: trim(selectedEventId),
    selectedEvent: selectedEvent
      ? {
          id: String(selectedEvent.id),
          name: String(selectedEvent.name || ""),
          eventType: selectedEvent.eventType || "",
        }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    competition: rules
      ? {
          registrationMode: rules.registrationMode,
          groupCount: rules.groupStage.groupCount,
          qualifiersPerGroup: rules.qualification.directQualifiersPerGroup,
          groupStageEnabled: rules.groupStage.groupStageEnabled,
          maxUnitsPerGroup: rules.groupStage.maxUnitsPerGroup,
          allowUnevenGroups: rules.groupStage.allowUnevenGroups,
          roundRobinPolicy: rules.groupStage.roundRobinPolicy,
          totalQualifiers: rules.qualification.totalQualifiers,
          wildcardSlots: rules.qualification.wildcardSlots,
          knockoutEnabled: rules.knockout.knockoutEnabled,
          pairingPolicy: rules.knockout.pairingPolicy,
          avoidSameGroupFirstRound: rules.knockout.avoidSameGroupFirstRound,
          qualifierCount: rules.knockout.qualifierCount,
          group2Source: contentResolved.source,
          scoringMethod: rules.matchScoring.scoringMethod,
          scoringMethodRequested: rules.matchScoring.scoringMethod,
          matchFormat: rules.matchScoring.matchFormat,
          matchFormatRequested: rules.matchScoring.matchFormat,
          roundTargets: rules.roundTargets,
          winByEnabled: rules.matchScoring.winCondition.winByEnabled,
          winByMargin: rules.matchScoring.winCondition.winByMargin,
          pointCapEnabled: rules.matchScoring.winCondition.pointCapEnabled,
          pointCap: rules.matchScoring.winCondition.pointCap,
          changeEndsEnabled: rules.matchScoring.changeEnd.changeEndsEnabled,
          changeEndsAtPoints: rules.matchScoring.changeEnd.changeEndsAtPoints,
          source: contentResolved.source,
          persistedSource: contentResolved.persistedSource,
        }
      : null,
    scoringCapabilities: {
      rally: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_RALLY
      ).effectiveSelectable,
      sideOut: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT
      ).effectiveSelectable,
      bestOf1: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_1
      ).effectiveSelectable,
      bestOf3: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3
      ).effectiveSelectable,
      winBy: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.WIN_BY
      ).effectiveSelectable,
      pointCap: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.POINT_CAP
      ).effectiveSelectable,
      changeEnd: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.CHANGE_END
      ).effectiveSelectable,
      sideOutBindingGap: resolveOfficialEffectiveCapability(
        COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT
      ).officialBinding?.durablePersistenceGap === true,
      bestOf3BindingGap: !BEST_OF_3_OPERATIONAL,
      source: "min(AdapterA, OfficialClassicBinding)",
    },
    rulesAdoption: (() => {
      if (!eventId) {
        return {
          ok: false,
          code: "EVENT_REQUIRED",
          profileDerived: false,
          formDraft: null,
        };
      }
      const surface = createOfficialOpenCompetitionRulesSurface({ tournament });
      const built = surface.buildProfile({ eventId });
      if (!built.ok) {
        return {
          ok: false,
          code: built.code,
          error: built.error,
          profileDerived: false,
          formDraft: null,
        };
      }
      const profile = built.profile;
      const scoring = profile.matchScoring || {};
      const win = scoring.winCondition || {};
      const changeEnd = scoring.changeEnd || {};
      const plan = surface.deriveQualificationPlan({ eventId });
      const wildcard = surface.resolveWildcardRankingPolicy({ eventId });
      const wildcardRequirement = resolveContentWildcardRequirement(tournament, {
        eventId,
      });
      const formDraft = Object.freeze({
        source: contentResolved?.source || CONTENT_RULES_SOURCE.CANONICAL_SYSTEM_DEFAULT,
        persistedSource: built.persistedSource,
        eventId,
        registrationMode: rules?.registrationMode,
        scoringMethod:
          String(scoring.scoringMethod || "").toUpperCase() === "SIDE_OUT"
            ? OFFICIAL_SCORING_METHOD.SIDE_OUT
            : OFFICIAL_SCORING_METHOD.RALLY,
        matchFormat:
          String(scoring.matchSeries || "").toUpperCase() === "BEST_OF_3"
            ? OFFICIAL_MATCH_FORMAT.BEST_OF_3
            : OFFICIAL_MATCH_FORMAT.BEST_OF_1,
        targetPoints: Number(scoring.targetPoints) || rules?.matchScoring?.targetPoints || 11,
        roundTargets: rules?.roundTargets || null,
        stageOverrides: rules?.stageOverrides || null,
        winByEnabled: win.winByEnabled !== false,
        winByMargin: Number(win.winByMargin) || 2,
        pointCapEnabled: win.pointCapEnabled === true,
        pointCap: win.pointCap != null ? Number(win.pointCap) : null,
        changeEndsEnabled: changeEnd.changeEndsEnabled === true,
        changeEndsAtPoints:
          changeEnd.changeEndsAtPoints != null
            ? Number(changeEnd.changeEndsAtPoints)
            : null,
        groupCount: Number(profile.groupStage?.groupCount) || rules?.groupStage?.groupCount || 4,
        maxUnitsPerGroup: rules?.groupStage?.maxUnitsPerGroup ?? null,
        allowUnevenGroups: rules?.groupStage?.allowUnevenGroups !== false,
        roundRobinPolicy: rules?.groupStage?.roundRobinPolicy || "SINGLE",
        qualifiersPerGroup:
          Number(profile.qualification?.directQualifiersPerGroup) ||
          rules?.qualification?.directQualifiersPerGroup ||
          2,
        totalQualifiers:
          Number(profile.qualification?.totalQualifiers) ||
          Number(plan?.totalQualifiers) ||
          null,
        wildcardSlots:
          Number(rules?.qualification?.wildcardSlots) ||
          Number(plan?.wildcardSlots) ||
          0,
        groupStageEnabled: profile.groupStage?.groupStageEnabled !== false,
        knockoutEnabled: profile.knockout?.knockoutEnabled !== false,
        pairingPolicy: rules?.knockout?.pairingPolicy,
        avoidSameGroupFirstRound: rules?.knockout?.avoidSameGroupFirstRound,
        qualifierCount: rules?.knockout?.qualifierCount ?? null,
        minLevel: rules?.eligibility?.minLevel ?? null,
        maxLevel: rules?.eligibility?.maxLevel ?? null,
        minRating: rules?.eligibility?.minRating ?? null,
        maxRating: rules?.eligibility?.maxRating ?? null,
        capacity: rules?.capacity || null,
        seedingPolicy: rules?.seedingPolicy || "NONE",
        inGroupTieBreak: rules?.inGroupTieBreak || null,
        crossGroupRanking: rules?.crossGroupRanking || null,
        walkover: rules?.walkover || null,
        checkIn: rules?.checkIn || null,
        substitution: rules?.substitution || null,
        scheduleConstraints: rules?.scheduleConstraints || null,
        courtRequirement: rules?.courtRequirement || null,
        refereeRequirement: rules?.refereeRequirement || null,
        publication: rules?.publication || null,
      });
      return {
        ok: true,
        profileDerived: true,
        ownsAuthority: false,
        adapterAId: surface.adapterAId,
        qualification: plan,
        wildcardFailClosed: wildcard.failClosed === true,
        wildcardCode: wildcard.code || null,
        contentRulesSource: contentResolved?.source || null,
        group2Source: group2?.ok ? group2.source : contentResolved?.source || null,
        group2LegacyActiveAuthority: false,
        knockoutPairingRuntime: Object.freeze({
          CROSS_GROUP: "SUPPORTED",
          SEEDED: "DEFERRED_FAIL_CLOSED",
          RANDOM: "DEFERRED_FAIL_CLOSED",
          avoidSameGroupForCrossGroup: "SUPPORTED",
          byeLocal: false,
        }),
        wildcardRequirement: Object.freeze({
          wildcardRequired: wildcardRequirement.wildcardRequired === true,
          wildcardSlots: wildcardRequirement.wildcardSlots || 0,
          requiredWildcardCount: wildcardRequirement.requiredWildcardCount || 0,
          ready: wildcardRequirement.ready === true,
          wildcardRankingCapability: wildcardRequirement.wildcardRankingCapability,
          wildcardAuthorityOwner: wildcardRequirement.wildcardAuthorityOwner,
          group4RuntimeImplemented: false,
          code: wildcardRequirement.code || null,
          error: wildcardRequirement.error || null,
        }),
        formDraft,
      };
    })(),
    eligibility: {
      minLevel: rules?.eligibility?.minLevel ?? null,
      maxLevel: rules?.eligibility?.maxLevel ?? null,
      minRating: rules?.eligibility?.minRating ?? null,
      maxRating: rules?.eligibility?.maxRating ?? null,
      scope: "CONTENT",
    },
    registrationWindow: {
      opensAt: registration.opensAt || null,
      closesAt: registration.closesAt || null,
      maxEntries: registration.maxEntries ?? null,
      lockedAt: registration.lockedAt || null,
      closedAt: registration.closedAt || null,
      scope: "TOURNAMENT",
    },
    authorities: {
      settings: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SETTINGS,
      event: "official-open-event-domain",
      contentCompetitionRules: `events[].${CONTENT_COMPETITION_RULES_PROPERTY}`,
      registrationSettings: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
      eligibility: "content.competitionRules.eligibility",
      scoringRules: "competition.rules.policy.gateway.v1",
      scoringExecution: OFFICIAL_EXPERIENCE_AUTHORITY.SCORING,
      refereeAssignment: OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT,
    },
  };
}

export function projectOfficialRegistration(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const registration = getRegistrationSettings(tournament);
  const publicationStatus = resolveOfficialRegistrationPublicationStatus(tournament);
  const entries = Array.isArray(selectedEvent?.entries) ? selectedEvent.entries : [];

  return {
    publicationStatus,
    publicationPublished: publicationStatus === "PUBLISHED",
    registrationLocked: isRegistrationLocked(tournament),
    window: {
      opensAt: registration.opensAt || null,
      closesAt: registration.closesAt || null,
      maxEntries: registration.maxEntries ?? null,
      lockedAt: registration.lockedAt || null,
      closedAt: registration.closedAt || null,
    },
    selectedEventId: trim(selectedEventId),
    selectedEvent: selectedEvent
      ? { id: String(selectedEvent.id), name: String(selectedEvent.name || "") }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    entryCount: entries.length,
    pendingCount: entries.filter((entry) => entry?.status === "pending").length,
    approvedCount: entries.filter(
      (entry) => entry?.status === "approved" || entry?.status === "active"
    ).length,
    rejectedCount: entries.filter((entry) => entry?.status === "rejected").length,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function projectOfficialParticipants(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  // DISPLAY/READ: sole-event may supply eventId via resolveSelectedEvent.
  const eventId = trim(selectedEventId) || (selectedEvent ? String(selectedEvent.id) : "");
  const content = eventId
    ? resolveContentCompetitionRules(tournament, {
        eventId,
        allowSoleEventInference: false,
      })
    : null;
  // Never use Tournament officialCompetition as Content registrationMode authority.
  const registrationMode = content?.ok ? content.rules.registrationMode : null;
  const entries = Array.isArray(selectedEvent?.entries) ? selectedEvent.entries : [];

  const rows = entries.map((entry) => {
    const playerIds = Array.isArray(entry?.playerIds)
      ? entry.playerIds.map(String).filter(Boolean)
      : [];
    const unit =
      registrationMode === "pair" || playerIds.length >= 2 ? "pair" : "individual";
    return {
      entryId: String(entry.id || ""),
      name: String(entry.name || "").trim() || "—",
      playerIds,
      unit,
      status: entry.status || "",
      clubName: String(entry.clubName || entry.club || "").trim() || null,
    };
  });

  return {
    selectedEventId: trim(selectedEventId),
    selectedEvent: selectedEvent
      ? { id: String(selectedEvent.id), name: String(selectedEvent.name || "") }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    registrationMode,
    officialMode: tournament?.officialMode || null,
    rows,
    total: rows.length,
    individualCount: rows.filter((row) => row.unit === "individual").length,
    pairCount: rows.filter((row) => row.unit === "pair").length,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PARTICIPANT,
  };
}

/**
 * Build persist patch for Official settings save (single explicit Save).
 *
 * Competition rules persist onto event.competitionRules (Content-owned).
 * Requires draft.eventId / draft.selectedEventId for rules saves.
 * Does NOT write competition-rule fields into settings.officialCompetition.
 * Does NOT dual-write settings.eligibilityRules or registration maxEntries
 * (CONFLICTING_LEGACY_RUNTIME — G1-B/C will switch gates).
 */
export function buildOfficialSettingsSavePatch(tournament, draft = {}) {
  const nameResult = normalizeOfficialTournamentName(
    draft.name != null ? draft.name : tournament?.name
  );
  if (!nameResult.ok) {
    return { ok: false, error: nameResult.error || "Tên giải không hợp lệ." };
  }

  const eventId = trim(draft.eventId || draft.selectedEventId);
  const scoringMethod = draft.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY;
  if (scoringMethod === OFFICIAL_SCORING_METHOD.SIDE_OUT && !SIDEOUT_OPERATIONAL) {
    return {
      ok: false,
      error: "SIDE_OUT chưa hỗ trợ trên Official classic path. Giữ RALLY.",
      code: "SIDE_OUT_UNSUPPORTED",
    };
  }
  const matchFormat = draft.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1;
  if (matchFormat === OFFICIAL_MATCH_FORMAT.BEST_OF_3 && !BEST_OF_3_OPERATIONAL) {
    return {
      ok: false,
      error: "BEST_OF_3 chưa hỗ trợ trên Official classic path. Giữ BEST_OF_1.",
      code: "BEST_OF_3_UNSUPPORTED",
    };
  }

  let next = tournament;

  if (draft.saveContentRules !== false && (draft.scoringMethod != null || draft.groupCount != null || eventId)) {
    if (!eventId) {
      return {
        ok: false,
        code: "EVENT_REQUIRED",
        error: "Chọn Nội dung tường minh trước khi lưu luật thi đấu (Content-owned).",
      };
    }
    const skillParsed = parseOfficialDecimalLevelInput(draft.maxLevel);
    const ratingParsed = parseOfficialDecimalLevelInput(draft.maxRating);
    if (!skillParsed.ok) {
      return { ok: false, error: skillParsed.error || "Trình độ tối đa không hợp lệ." };
    }
    if (!ratingParsed.ok) {
      return { ok: false, error: ratingParsed.error || "Rating tối đa không hợp lệ." };
    }

    try {
      // Group 1 overlays stay explicit so Save round-trips even when
      // draft.contentRules is present (outer capacity/eligibility/seeding
      // must not be dropped). Mutation requires eventId (fail-closed).
      const patched = patchEventContentCompetitionRules(next, eventId, {
        contentRules: draft.contentRules || draft,
        registrationMode: draft.registrationMode,
        capacity: draft.capacity,
        seedingPolicy: draft.seedingPolicy,
        maxParticipants: draft.maxParticipants,
        maxPairs: draft.maxPairs,
        scoringMethod,
        matchFormat,
        groupCount: draft.groupCount,
        groupStageEnabled: draft.groupStageEnabled,
        maxUnitsPerGroup: draft.maxUnitsPerGroup,
        allowUnevenGroups: draft.allowUnevenGroups,
        roundRobinPolicy: draft.roundRobinPolicy,
        qualifiersPerGroup: draft.qualifiersPerGroup,
        totalQualifiers: draft.totalQualifiers,
        wildcardSlots: draft.wildcardSlots,
        knockoutEnabled: draft.knockoutEnabled,
        pairingPolicy: draft.pairingPolicy,
        avoidSameGroupFirstRound: draft.avoidSameGroupFirstRound,
        qualifierCount: draft.qualifierCount,
        roundTargets: draft.roundTargets,
        stageOverrides: draft.stageOverrides,
        targetPoints:
          draft.targetPoints ??
          draft.roundTargets?.group ??
          undefined,
        winByEnabled: draft.winByEnabled,
        winByMargin: draft.winByMargin,
        pointCapEnabled: draft.pointCapEnabled,
        pointCap: draft.pointCap,
        changeEndsEnabled: draft.changeEndsEnabled,
        changeEndsAtPoints: draft.changeEndsAtPoints,
        eligibility: {
          minLevel: draft.minLevel,
          maxLevel: skillParsed.value,
          minRating: draft.minRating,
          maxRating: ratingParsed.value,
        },
      });
      next = patched.tournament;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err || "Không lưu được luật Nội dung."),
        code: err?.code || "CONTENT_RULES_PATCH_FAILED",
      };
    }
  }

  const identity = buildIdentityPatch({
    name: nameResult.name,
    hostClubName: draft.hostClubName != null ? draft.hostClubName : tournament?.hostClubName,
    officialMode: draft.officialMode,
  });

  return {
    ok: true,
    patch: {
      ...identity,
      events: next.events,
      // Preserve settings blob as-is (legacy fields untouched; not re-authored).
      settings: next.settings,
    },
    contentRulesProperty: CONTENT_COMPETITION_RULES_PROPERTY,
    eventId: eventId || null,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SETTINGS,
  };
}

export function buildOfficialEventMetaPatch(tournament, selectedEventId, eventPatch) {
  const wanted = trim(selectedEventId);
  if (!wanted) {
    return { ok: false, error: "Chọn nội dung trước khi lưu.", code: "EVENT_REQUIRED" };
  }
  return buildUpdateEventPatch(tournament, wanted, eventPatch);
}

export function buildOfficialAddEventPatch(tournament, eventTypeOrOptions) {
  return buildAddOfficialEventPatch(tournament, eventTypeOrOptions);
}

export function buildOfficialPublishRegistrationPatch(tournament) {
  const status = resolveOfficialRegistrationPublicationStatus(tournament);
  if (status === "PUBLISHED") {
    return { ok: true, alreadyPublished: true, patch: null, nextStatus: null };
  }
  return {
    ok: true,
    alreadyPublished: false,
    patch: { status: TOURNAMENT_STATUS.REGISTRATION },
    nextStatus: TOURNAMENT_STATUS.REGISTRATION,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function buildOfficialRegistrationWindowPatch(tournament, windowPatch, options = {}) {
  const result = setRegistrationWindow(tournament, windowPatch, options);
  if (!result.ok) return result;
  return {
    ok: true,
    patch: tournamentPatchFrom(result.tournament, ["settings", "events", "status"]),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function buildOfficialCloseRegistrationPatch(tournament, options = {}) {
  const result = lockRegistration(tournament, options);
  if (!result.ok) return result;
  return {
    ok: true,
    alreadyLocked: Boolean(result.alreadyLocked),
    patch: tournamentPatchFrom(result.tournament, ["settings", "events", "status"]),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function buildOfficialApproveEntryPatch(tournament, entryId, options = {}) {
  const result = gatedApproveEntry(tournament, entryId, options);
  if (!result.ok) return result;
  return {
    ok: true,
    patch: tournamentPatchFrom(result.tournament, ["events", "settings"]),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PARTICIPANT,
  };
}

export function buildOfficialRemoveEntryPatch(tournament, selectedEventId, entryId) {
  const wantedEvent = trim(selectedEventId);
  const wantedEntry = trim(entryId);
  if (!wantedEvent) {
    return { ok: false, error: "Chọn nội dung trước khi xóa VĐV.", code: "EVENT_REQUIRED" };
  }
  if (!wantedEntry) {
    return { ok: false, error: "Thiếu entryId.", code: "ENTRY_REQUIRED" };
  }
  const events = listTournamentEvents(tournament);
  const event = events.find((item) => String(item.id) === wantedEvent);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung.", code: "EVENT_NOT_FOUND" };
  }
  const nextEntries = (Array.isArray(event.entries) ? event.entries : []).filter(
    (entry) => String(entry.id) !== wantedEntry
  );
  const nextEvents = events.map((item) =>
    String(item.id) === wantedEvent ? { ...item, entries: nextEntries } : item
  );
  return {
    ok: true,
    patch: { events: nextEvents },
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PARTICIPANT,
  };
}

/**
 * Screen 06 — form pairs. Explicit operator trigger only.
 * OPEN INDIVIDUAL → suggestOpenRandomEntriesFromPlayers
 * AI BALANCE → suggestBalancedEntriesFromIndividuals
 * OPEN PAIR → fail closed (no re-pair)
 */
export function buildOfficialFormPairsPatch(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const events = listTournamentEvents(tournament);
  if (events.length > 1 && !selectedEventId) {
    return {
      ok: false,
      error: "Chọn nội dung trước khi ghép cặp.",
      code: "EVENT_REQUIRED",
    };
  }
  const event = resolveSelectedEvent(events, selectedEventId);
  if (!event) {
    return {
      ok: false,
      error: "Không tìm thấy nội dung thi đấu.",
      code: "EVENT_NOT_FOUND",
    };
  }

  const modeResolution = resolveOfficialPairFormationMode(tournament, {
    eventId: event.id,
  });
  if (!modeResolution.ok || modeResolution.mode === PAIR_FORMATION_MODE.NOT_SUPPORTED) {
    return {
      ok: false,
      error: modeResolution.error || "Chế độ ghép cặp không được hỗ trợ.",
      code: modeResolution.code || "PAIR_FORMATION_NOT_SUPPORTED",
    };
  }
  if (modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
    return {
      ok: false,
      error: "Đăng ký theo cặp — không ghép lại. Dùng cặp đã đăng ký.",
      code: "OPEN_PAIR_NO_REPAIR",
      mode: modeResolution.mode,
    };
  }

  const sub = projectOfficialDrawSubsteps(tournament, event.id);
  if (sub.groupsCreated) {
    return {
      ok: false,
      error: "Đã có bảng đấu — không ghép cặp lại khi bảng đã tạo.",
      code: "GROUPS_BLOCK_REPAIR",
    };
  }

  const players = Array.isArray(options.players) ? options.players : [];
  let pairingFn = suggestOpenRandomEntriesFromPlayers;
  if (modeResolution.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE) {
    pairingFn = suggestBalancedEntriesFromIndividuals;
  } else if (modeResolution.pairingAuthority !== OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM) {
    return {
      ok: false,
      error: "Authority ghép cặp không hợp lệ.",
      code: "INVALID_PAIRING_AUTHORITY",
    };
  }

  // Guard: Open random must not receive AI Balance writer.
  if (
    modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING &&
    pairingFn !== suggestOpenRandomEntriesFromPlayers
  ) {
    return {
      ok: false,
      error: "Open Individual chỉ được ghép ngẫu nhiên.",
      code: "OPEN_RANDOM_AUTHORITY_VIOLATION",
    };
  }
  if (
    modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING &&
    pairingFn !== suggestBalancedEntriesFromIndividuals
  ) {
    return {
      ok: false,
      error: "AI Balance phải dùng engine cân bằng hiện có.",
      code: "AI_BALANCE_AUTHORITY_VIOLATION",
    };
  }

  const result = formOfficialIndividualPairs({
    tournament,
    eventId: event.id,
    players,
    eventType: event.eventType,
    pairingFn,
    pairingOptions: {
      ...(options.pairingOptions || {}),
      tournamentId: trim(tournament?.id),
      eventId: event.id,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || "Ghép cặp thất bại.",
      code: "FORM_PAIRS_FAILED",
      pairingInvoked: result.pairingInvoked,
    };
  }

  return {
    ok: true,
    patch: tournamentPatchFrom(result.tournament, ["events"]),
    pairs: result.pairs || result.drawEntries || [],
    mode: modeResolution.mode,
    pairingAuthority: modeResolution.pairingAuthority,
    usesRating: modeResolution.usesRating === true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING,
  };
}

export function projectOfficialPairFormation(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  // DISPLAY sole-event resolve: only when exactly one Content (SOLE_EVENT_COMPATIBILITY).
  const event = resolveSelectedEvent(events, selectedEventId);
  const modeResolution = event
    ? resolveOfficialPairFormationMode(tournament, { eventId: event.id })
    : {
        ok: false,
        mode: PAIR_FORMATION_MODE.NOT_SUPPORTED,
        code: "EVENT_REQUIRED",
        error: "Chọn nội dung tường minh trước khi xem hình thành cặp.",
      };
  const sub = event
    ? projectOfficialDrawSubsteps(tournament, event.id)
    : null;

  return {
    modeResolution,
    selectedEventId: trim(selectedEventId),
    selectedEvent: event
      ? { id: String(event.id), name: String(event.name || ""), eventType: event.eventType }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    substeps: sub,
    pairingComplete: Boolean(sub?.pairingComplete),
    groupsCreated: Boolean(sub?.groupsCreated),
    formPairsEnabled:
      modeResolution.ok &&
      (modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING ||
        modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING) &&
      Boolean(event) &&
      !sub?.groupsCreated &&
      !sub?.singlesContent,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING,
  };
}

export const OFFICIAL_COMMAND_DELEGATION_MAP = Object.freeze({
  saveSettings: "buildOfficialSettingsSavePatch → updateTournamentCommand",
  saveEventMeta: "buildUpdateEventPatch → updateTournamentCommand",
  addEvent: "buildAddOfficialEventPatch → updateTournamentCommand",
  publishRegistration: "status → REGISTRATION via update/setStatus",
  saveRegistrationWindow: "setRegistrationWindow → updateTournamentCommand",
  closeRegistration: "lockRegistration → updateTournamentCommand",
  approveEntry: "gatedApproveEntry → updateTournamentCommand",
  removeEntry: "event.entries filter persist → updateTournamentCommand",
  formPairs:
    "resolveOfficialPairFormationMode → formOfficialIndividualPairs(suggestOpenRandomEntriesFromPlayers|suggestBalancedEntriesFromIndividuals) → event.drawEntries",
  presentPairDraw:
    "listOfficialPairDrawUnits → buildPairingSteps (presentation only; mutates=false)",
  createGroupDraw:
    "resolveOfficialGroupDrawDispatch(OPEN_RANDOM) → getOfficialGroupDrawUnits → buildOfficialOpenPlan → event.groups + settings.draw (matches stripped in O5)",
  lockGroupDraw: "lockDraw → settings.draw",
  publishGroupDraw: "publishDraw → settings.draw (no schedule/match mutation)",
  reopenGroupDraw: "resolveDrawReopenPermission → reopenDraw → settings.draw",
  regenerateGroupDraw:
    "canRegenerateDraw / downstream guards → forceRedrawDraw? → buildOfficialCreateGroupDrawPatch",
  presentGroupDraw: "buildRandomDrawSteps(event.groups) presentation only",
  createGroupMatches:
    "buildGroupStageSchedule → event.matches (group membership preserved; nested group.matches cleared)",
  assignGroupSchedule:
    "scheduleOfficialGroupMatches → event.matches scheduledStart/End/courtId + settings.schedule",
  publishSchedule: "publishSchedule → settings.schedule (no match regeneration)",
});
