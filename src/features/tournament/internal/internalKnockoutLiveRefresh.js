/**
 * Live Internal knockout refresh (IT-E2E-BROWSER-020).
 * Organizer Bracket must follow canonical referee commits without F5.
 * Progression is derived from completed KO matches via ranking/bracket engine,
 * then persisted through the existing organizer canonical update path.
 */
import { MATCH_STAGE, MATCH_STATUS } from "../../../models/tournament/constants.js";
import {
  resolveBracketProgress,
  syncKnockoutMatchParticipants,
} from "../../../tournament/engines/bracketEngine.js";
import { getInternalCanonicalEvent } from "./internalPersistedDrawGroups.js";

/** Shared generic cadence with Team tournament polling fallback. Not MLP. */
export const INTERNAL_SNAPSHOT_POLL_MS = 5000;

export const INTERNAL_KNOCKOUT_REFRESH_MECHANISM =
  "version-aware silent poll";

export const INTERNAL_WINNER_PROGRESSION_ENGINE =
  "bracketEngine.syncKnockoutMatchParticipants";

export function knockoutMatchFingerprint(event) {
  return JSON.stringify(
    (event?.matches || [])
      .filter((match) => match?.bracketMatchId)
      .map((match) => ({
        id: String(match.id || ""),
        status: String(match.status || ""),
        scoreA: match.scoreA ?? null,
        scoreB: match.scoreB ?? null,
        winnerId: String(match.winnerId || ""),
        entryAId: String(match.entryAId || ""),
        entryBId: String(match.entryBId || ""),
      }))
  );
}

export function detectKnockoutProgressionDrift(event) {
  if (!event?.bracket?.rounds?.length) {
    return { drifted: false, event: event || null, before: "[]", after: "[]" };
  }
  const synced = syncKnockoutMatchParticipants(event);
  const before = knockoutMatchFingerprint(event);
  const after = knockoutMatchFingerprint(synced);
  return {
    drifted: before !== after,
    event: synced,
    before,
    after,
  };
}

export function findInternalFinalMatch(event) {
  const matches = event?.matches || [];
  return (
    matches.find((match) => String(match.stage || "") === MATCH_STAGE.FINAL) ||
    matches.find((match) => String(match.bracketMatchId || "") === "R2-M1") ||
    matches.find((match) => /^ko-R2-M1$/i.test(String(match.id || ""))) ||
    null
  );
}

export function projectInternalLiveKnockout(event) {
  const drift = detectKnockoutProgressionDrift(event);
  const liveEvent = drift.event || event || null;
  const progress =
    liveEvent?.bracket?.rounds?.length ? resolveBracketProgress(liveEvent) : null;
  const finalMatch = findInternalFinalMatch(liveEvent);
  const knockoutMatches = (liveEvent?.matches || []).filter(
    (match) => match?.bracketMatchId
  );
  const completedKnockoutCount = knockoutMatches.filter(
    (match) =>
      match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
  ).length;
  return {
    event: liveEvent,
    drifted: drift.drifted,
    progress,
    finalMatch,
    completedKnockoutCount,
    pendingKnockoutCount: knockoutMatches.length - completedKnockoutCount,
    fingerprint: drift.after,
    authority: drift.drifted ? "derived_pending_persist" : "canonical",
    engine: INTERNAL_WINNER_PROGRESSION_ENGINE,
  };
}

export function applyInternalLiveKnockoutToTournament(tournament) {
  if (!tournament?.events?.length) {
    return {
      tournament: tournament || null,
      projection: projectInternalLiveKnockout(null),
    };
  }
  const live = projectInternalLiveKnockout(tournament.events[0]);
  return {
    tournament: {
      ...tournament,
      events: tournament.events.map((event, index) =>
        index === 0 ? live.event : event
      ),
    },
    projection: live,
  };
}

export function shouldPersistKnockoutProgression({
  drifted = false,
  mutationActive = false,
  persistInFlight = false,
} = {}) {
  return Boolean(drifted) && !mutationActive && !persistInFlight;
}

export function shouldApplySilentCanonicalSnapshot({
  mutationActive = false,
  currentVersion = null,
  incomingVersion = null,
} = {}) {
  if (mutationActive) return false;
  if (incomingVersion == null || incomingVersion === "") return false;
  if (currentVersion == null || currentVersion === "") return true;
  return Number(incomingVersion) !== Number(currentVersion);
}

export function shouldReplaceCanonicalSnapshot(current, incoming) {
  if (!incoming) return false;
  if (!current) return true;
  if (Number(incoming.version) !== Number(current.version)) return true;
  return (
    knockoutMatchFingerprint(getInternalCanonicalEvent(incoming)) !==
    knockoutMatchFingerprint(getInternalCanonicalEvent(current))
  );
}

export function resolveSilentReloadPresentation({ hasTournament = false } = {}) {
  return {
    initialLoading: !hasTournament,
    silent: Boolean(hasTournament),
    fullPageLoading: !hasTournament,
    retainSection: Boolean(hasTournament),
  };
}

export function planInternalOrganizerSnapshotRefresh({
  organizerBracketOpen = false,
  mutationActive = false,
  currentVersion = null,
  incomingVersion = null,
} = {}) {
  const apply = shouldApplySilentCanonicalSnapshot({
    mutationActive,
    currentVersion,
    incomingVersion,
  });
  return {
    shouldReload: Boolean(organizerBracketOpen) && !mutationActive,
    shouldApply: apply,
    silent: true,
    fullPageLoading: false,
    mechanism: INTERNAL_KNOCKOUT_REFRESH_MECHANISM,
    expectedUpdateMaxDelayMs: INTERNAL_SNAPSHOT_POLL_MS,
  };
}

export function knockoutProgressionIsIdempotent(event) {
  const once = syncKnockoutMatchParticipants(event || {});
  const twice = syncKnockoutMatchParticipants(once);
  return knockoutMatchFingerprint(once) === knockoutMatchFingerprint(twice);
}
