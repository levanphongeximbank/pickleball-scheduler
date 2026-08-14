/**
 * Daily Play visibility/poll refresh helpers.
 * Pure module so unit tests can cover DP-13 without mounting React.
 */

export const DAILY_PLAY_REFRESH_REASON = Object.freeze({
  INITIAL: "INITIAL_LOADING",
  POLL: "POLL",
  BACKGROUND: "BACKGROUND_REFRESH",
  VISIBILITY_RESUME: "VISIBILITY_RESUME",
  MUTATION: "MUTATION_PENDING",
});

export function isDocumentHidden(doc = globalThis.document) {
  if (!doc) return false;
  return doc.hidden === true || doc.visibilityState === "hidden";
}

export function shouldSkipRoutinePoll(reason, documentHidden) {
  return reason === DAILY_PLAY_REFRESH_REASON.POLL && Boolean(documentHidden);
}

export function isSilentRefreshReason(reason) {
  return (
    reason === DAILY_PLAY_REFRESH_REASON.POLL ||
    reason === DAILY_PLAY_REFRESH_REASON.BACKGROUND ||
    reason === DAILY_PLAY_REFRESH_REASON.VISIBILITY_RESUME
  );
}

function stablePairs(items, pick) {
  return (items || [])
    .map(pick)
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
}

export function buildCanonicalSnapshotSignature(snapshot) {
  if (!snapshot || snapshot.ok === false) return "";
  const daily = snapshot.dailyPlay || snapshot.state || {};
  const revision = Number(daily.revision ?? snapshot.revision ?? 0);
  const matches = stablePairs(daily.matches, (match) => [
    String(match?.id || match?.matchId || ""),
    String(match?.status || ""),
    String(match?.courtId ?? ""),
    String(match?.scoreA ?? ""),
    String(match?.scoreB ?? ""),
    String(match?.winner ?? match?.winnerSide ?? ""),
    String((match?.scoreLog || []).length),
  ]);
  const courts = stablePairs(snapshot.courts, (court) => [
    String(court?.id || court?.courtId || ""),
    String(court?.status || ""),
    court?.available === false ? "0" : "1",
    court?.busy === true ? "1" : "0",
    String(court?.currentMatchId || court?.leaseMatchId || ""),
  ]);
  const leases = stablePairs(snapshot.activeLeases || snapshot.leases, (lease) => [
    String(lease?.courtId || ""),
    String(lease?.matchId || ""),
    String(lease?.status || ""),
  ]);
  const occupied = [...(snapshot.occupiedCourtIds || [])].map(String).sort();
  const checkedIn = [...(daily.checkedInPlayerIds || [])].map(String).sort();
  return JSON.stringify({ revision, matches, courts, leases, checkedIn, occupied });
}

export function shouldReplaceCanonicalSnapshot(currentSignature, nextSnapshot) {
  const nextSignature = buildCanonicalSnapshotSignature(nextSnapshot);
  if (currentSignature && currentSignature === nextSignature) {
    return { replace: false, signature: nextSignature };
  }
  return { replace: true, signature: nextSignature };
}

/**
 * One useful get_state at a time.
 * Poll + visibility resume join the in-flight read.
 * Mutation readback bumps generation so a stale poll cannot apply.
 */
export function createDailyPlayRefreshFence() {
  let generation = 0;
  let inFlight = null;

  return {
    begin(reason) {
      const isMutation = reason === DAILY_PLAY_REFRESH_REASON.MUTATION;
      if (inFlight && !isMutation) {
        return { kind: "join", promise: inFlight, generation: null, reason };
      }
      generation += 1;
      const gen = generation;
      let resolveDone;
      const promise = new Promise((resolve) => {
        resolveDone = resolve;
      });
      const waitFor = isMutation ? inFlight : null;
      inFlight = promise;
      return {
        kind: "start",
        generation: gen,
        promise,
        reason,
        waitFor,
        done(value) {
          resolveDone(value);
        },
      };
    },
    finish(token, result) {
      if (!token || token.kind !== "start") return;
      token.done(result);
      if (inFlight === token.promise) {
        inFlight = null;
      }
    },
    isCurrent(generationValue) {
      return Number(generationValue) === generation;
    },
    get generation() {
      return generation;
    },
    get hasInFlight() {
      return Boolean(inFlight);
    },
  };
}
