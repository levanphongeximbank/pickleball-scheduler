/**
 * Internal Awards workspace (IT-E2E-BROWSER-022).
 * Champion/runner-up are derived from the existing awards engine.
 * Completion stays fail-closed until awards are confirmed into settings.awards.
 */
import {
  AWARD_KEY,
  assignAward,
  buildAwardsPreview,
  getAwardsState,
} from "../../individual-tournament/engines/awardsEngine.js";
import { assertInternalCompetitionComplete } from "./internalTournamentCompletionEligibility.js";
import {
  COMPETITION_UNIT,
  resolveInternalCompetitionUnit,
} from "./internalTournamentCompetitionUnit.js";

export const INTERNAL_AWARDS_PERSISTENCE_PATH = "settings.awards.assignments";

export const INTERNAL_AWARDS_CONFIRMATION_REQUIRED = true;

function pickAward(preview, key) {
  return (preview?.awards || []).find((award) => award.key === key) || null;
}

function pickRank(preview, rank) {
  return (preview?.ranking || []).find((row) => Number(row.rank) === rank) || null;
}

function assignmentId(state, key) {
  return String(state?.assignments?.[key] || "").trim();
}

export function isInternalAwardsConfirmed(tournament, preview) {
  const state = getAwardsState(tournament);
  const champion =
    pickAward(preview, AWARD_KEY.CHAMPION) || pickRank(preview, 1);
  const runnerUp =
    pickAward(preview, AWARD_KEY.RUNNER_UP) || pickRank(preview, 2);
  const championId = String(champion?.entryId || "").trim();
  const runnerUpId = String(runnerUp?.entryId || "").trim();
  if (!championId || !runnerUpId) return false;
  return (
    assignmentId(state, AWARD_KEY.CHAMPION) === championId &&
    assignmentId(state, AWARD_KEY.RUNNER_UP) === runnerUpId
  );
}

export function projectInternalAwardsWorkspace(tournament) {
  const event = tournament?.events?.[0] || null;
  const unit = resolveInternalCompetitionUnit(event?.type || event?.eventType);
  const preview = tournament
    ? buildAwardsPreview(tournament, { eventId: event?.id })
    : { awards: [], ranking: [] };
  const champion =
    pickAward(preview, AWARD_KEY.CHAMPION) || pickRank(preview, 1);
  const runnerUp =
    pickAward(preview, AWARD_KEY.RUNNER_UP) || pickRank(preview, 2);
  const derivedReady = Boolean(
    String(champion?.entryId || "").trim() && String(runnerUp?.entryId || "").trim()
  );
  const confirmed = isInternalAwardsConfirmed(tournament, preview);
  const awardsReady = derivedReady && confirmed;
  const competition = assertInternalCompetitionComplete(tournament);
  const completionReady = Boolean(competition.ok && awardsReady);

  return {
    visible: true,
    engine: "individual-tournament/awardsEngine.buildAwardsPreview",
    authority: "derived_then_canonical_confirm",
    confirmationRequired: INTERNAL_AWARDS_CONFIRMATION_REQUIRED,
    persistenceRequired: true,
    persistencePath: INTERNAL_AWARDS_PERSISTENCE_PATH,
    rowIdentity: unit === COMPETITION_UNIT.PLAYER ? "PLAYER" : "TEAM",
    unit,
    champion: champion
      ? {
          entryId: champion.entryId || "",
          name: champion.entryName || champion.name || "",
        }
      : null,
    runnerUp: runnerUp
      ? {
          entryId: runnerUp.entryId || "",
          name: runnerUp.entryName || runnerUp.name || "",
        }
      : null,
    derivedReady,
    awardsReady,
    completionReady,
    completionEnablePredicate:
      "competitionComplete && awards.assignments.champion && awards.assignments.runnerUp",
    competitionOk: Boolean(competition.ok),
    competitionError: competition.ok ? null : competition.error || null,
  };
}

export function confirmInternalAwards(tournament, options = {}) {
  if (!tournament) {
    return { ok: false, error: "Thiếu giải để xác nhận trao giải." };
  }
  const preview = buildAwardsPreview(tournament, {
    eventId: tournament.events?.[0]?.id,
  });
  const champion = pickAward(preview, AWARD_KEY.CHAMPION) || pickRank(preview, 1);
  const runnerUp = pickAward(preview, AWARD_KEY.RUNNER_UP) || pickRank(preview, 2);
  if (!champion?.entryId || !runnerUp?.entryId) {
    return {
      ok: false,
      error: "Chưa có nhà vô địch và á quân để xác nhận trao giải.",
    };
  }

  let next = tournament;
  const championResult = assignAward(next, AWARD_KEY.CHAMPION, champion.entryId, options);
  if (!championResult.ok) return championResult;
  next = championResult.tournament;
  const runnerResult = assignAward(next, AWARD_KEY.RUNNER_UP, runnerUp.entryId, options);
  if (!runnerResult.ok) return runnerResult;
  next = runnerResult.tournament;

  return {
    ok: true,
    tournament: next,
    projection: projectInternalAwardsWorkspace(next),
  };
}

export function resolveInternalCompletionAction(tournament) {
  const projection = projectInternalAwardsWorkspace(tournament);
  if (!projection.completionReady) {
    return {
      enabled: false,
      reason: projection.awardsReady
        ? projection.competitionError || "Chưa đủ điều kiện đóng giải."
        : "Xác nhận trao giải trước khi hoàn tất.",
    };
  }
  return { enabled: true, reason: null };
}
