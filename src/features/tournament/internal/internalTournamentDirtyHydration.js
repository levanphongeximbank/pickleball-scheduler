/**
 * Dirty-aware Internal setup hydration decision (IT-REV-003).
 * Pure helper — no React, no localStorage, no timers.
 */
import { hydrateInternalSetupFromTournament } from "./internalTournamentSetupHydration.js";

export const INTERNAL_HYDRATION_ACTION = Object.freeze({
  HYDRATE_FULL: "HYDRATE_FULL",
  KEEP_DIRTY: "KEEP_DIRTY",
  IGNORE_STALE: "IGNORE_STALE",
});

function sameId(a, b) {
  return String(a || "") === String(b || "");
}

function samePlayerIds(a = [], b = []) {
  if (a.length !== b.length) return false;
  const left = [...a].map(String).sort();
  const right = [...b].map(String).sort();
  return left.every((id, index) => id === right[index]);
}

/**
 * Compare form fields against last hydrated baseline projection.
 */
export function computeInternalSetupDirtyFlags(form, baselineHydration) {
  const base = baselineHydration || {};
  return {
    eventType: String(form?.eventType || "") !== String(base.eventType || ""),
    groupCount: Number(form?.groupCount) !== Number(base.groupCount),
    selectedPlayerIds: !samePlayerIds(
      form?.selectedPlayerIds || [],
      base.selectedPlayerIds || []
    ),
  };
}

export function isInternalSetupFormDirty(dirtyFlags) {
  return Boolean(
    dirtyFlags?.eventType || dirtyFlags?.groupCount || dirtyFlags?.selectedPlayerIds
  );
}

/**
 * @param {object} input
 * @returns {{
 *   action: string,
 *   apply: { eventType?: boolean, groupCount?: boolean, selectedPlayerIds?: boolean },
 *   hydration: object|null,
 *   nextBaselineVersion: number|null,
 *   nextTournamentId: string,
 *   nextEventId: string,
 *   staleServerRevision: boolean,
 * }}
 */
export function decideInternalSetupHydration(input = {}) {
  const {
    tournament = null,
    hydratedTournamentId = "",
    hydratedEventId = "",
    baselineVersion = null,
    knownServerVersion = null,
    form = {},
    baselineHydration = null,
    incomingGeneration = 0,
    appliedGeneration = 0,
  } = input;

  if (
    Number(incomingGeneration) > 0 &&
    Number(appliedGeneration) > 0 &&
    Number(incomingGeneration) < Number(appliedGeneration)
  ) {
    return {
      action: INTERNAL_HYDRATION_ACTION.IGNORE_STALE,
      apply: { eventType: false, groupCount: false, selectedPlayerIds: false },
      hydration: null,
      nextBaselineVersion: baselineVersion,
      nextTournamentId: hydratedTournamentId,
      nextEventId: hydratedEventId,
      staleServerRevision: false,
    };
  }

  if (!tournament?.id) {
    return {
      action: INTERNAL_HYDRATION_ACTION.KEEP_DIRTY,
      apply: { eventType: false, groupCount: false, selectedPlayerIds: false },
      hydration: null,
      nextBaselineVersion: baselineVersion,
      nextTournamentId: hydratedTournamentId,
      nextEventId: hydratedEventId,
      staleServerRevision: false,
    };
  }

  const eventId = String(tournament.events?.[0]?.id || "");
  const tournamentId = String(tournament.id);
  const serverVersion = resolveVersion(tournament.version ?? knownServerVersion);
  const hydration = hydrateInternalSetupFromTournament(tournament, {
    queryEventType: form?.queryEventType || null,
  });

  const identityChanged =
    !sameId(hydratedTournamentId, tournamentId) ||
    (!!eventId && !!hydratedEventId && !sameId(hydratedEventId, eventId)) ||
    !hydratedTournamentId;

  if (identityChanged) {
    return {
      action: INTERNAL_HYDRATION_ACTION.HYDRATE_FULL,
      apply: { eventType: true, groupCount: true, selectedPlayerIds: true },
      hydration,
      nextBaselineVersion: serverVersion,
      nextTournamentId: tournamentId,
      nextEventId: eventId,
      staleServerRevision: false,
    };
  }

  const dirtyFlags = computeInternalSetupDirtyFlags(form, baselineHydration || hydration);
  const dirty = isInternalSetupFormDirty(dirtyFlags);
  const versionChanged =
    baselineVersion != null &&
    serverVersion != null &&
    Number(baselineVersion) !== Number(serverVersion);

  if (!dirty) {
    return {
      action: INTERNAL_HYDRATION_ACTION.HYDRATE_FULL,
      apply: { eventType: true, groupCount: true, selectedPlayerIds: true },
      hydration,
      nextBaselineVersion: serverVersion,
      nextTournamentId: tournamentId,
      nextEventId: eventId,
      staleServerRevision: false,
    };
  }

  // Dirty form: never clobber local edits on unrelated server revision.
  return {
    action: INTERNAL_HYDRATION_ACTION.KEEP_DIRTY,
    apply: { eventType: false, groupCount: false, selectedPlayerIds: false },
    hydration,
    nextBaselineVersion: baselineVersion,
    nextTournamentId: tournamentId,
    nextEventId: eventId,
    staleServerRevision: versionChanged,
    dirtyFlags,
  };
}

/**
 * After a successful own write: advance baseline; only clear dirty for committed keys.
 */
export function advanceHydrationBaselineAfterOwnWrite({
  tournament,
  committedKeys = [],
  previousBaselineHydration = null,
}) {
  const hydration = hydrateInternalSetupFromTournament(tournament);
  const nextBaseline = { ...(previousBaselineHydration || {}) };
  for (const key of committedKeys) {
    if (key in hydration) nextBaseline[key] = hydration[key];
  }
  if (!committedKeys.length) {
    Object.assign(nextBaseline, {
      eventType: hydration.eventType,
      groupCount: hydration.groupCount,
      selectedPlayerIds: hydration.selectedPlayerIds,
    });
  }
  return {
    baselineVersion: resolveVersion(tournament?.version),
    baselineHydration: {
      ...nextBaseline,
      eventType: nextBaseline.eventType ?? hydration.eventType,
      groupCount: nextBaseline.groupCount ?? hydration.groupCount,
      selectedPlayerIds: nextBaseline.selectedPlayerIds ?? hydration.selectedPlayerIds,
    },
    hydration,
  };
}

function resolveVersion(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
