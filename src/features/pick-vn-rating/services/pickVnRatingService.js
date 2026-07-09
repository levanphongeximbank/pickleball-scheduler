import { snapPickVnRating } from "../constants/pickVnRatingScale.js";
import { GENDER_TO_PLAYER_LABEL } from "../../player-rating/playerSkillAssessmentConfig.js";
import { calculatePlayerAssessment } from "../../player-rating/playerSkillAssessmentEngine.js";
import { savePlayerAssessment } from "../../player-rating/playerRatingAssessmentLocalStore.js";
import { RATING_STATUS } from "../constants/ratingStatus.js";
import {
  buildClubPlayerRatingMirror,
  buildRatingHistoryEntry,
  normalizePickVnRatingRecord,
} from "../models/pickVnRating.js";
import {
  findPickVnRatingByAuthUserId,
  listPickVnRatings,
  upsertPickVnRating,
} from "../storage/pickVnRatingLocalStore.js";
import { rpcPickVnSyncRating } from "./pickVnRatingRpcService.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import { updateSelfDemographics } from "../../identity/services/selfProfileService.js";

function buildRatingId(authUserId) {
  return `pvn-rating-${String(authUserId)}`;
}

export function getPickVnRatingByAuthUserId(authUserId) {
  if (!authUserId) {
    return null;
  }
  const row = findPickVnRatingByAuthUserId(authUserId);
  return row ? normalizePickVnRatingRecord(row) : null;
}

export function listAllPickVnRatings() {
  return listPickVnRatings().map((row) => normalizePickVnRatingRecord(row)).filter(Boolean);
}

export function hasCompletedPickVnOnboarding(authUserId) {
  const record = getPickVnRatingByAuthUserId(authUserId);
  if (!record) {
    return false;
  }
  const answers = record.assessmentAnswers;
  return (
    answers &&
    typeof answers === "object" &&
    Object.keys(answers).length > 0 &&
    (record.assessmentScore != null || record.provisionalRating != null)
  );
}

export function needsPickVnOnboarding(authUserId) {
  return !hasCompletedPickVnOnboarding(authUserId);
}

export function syncRatingToClubPlayer(player, authUserId = null) {
  const record = authUserId ? getPickVnRatingByAuthUserId(authUserId) : null;
  return {
    ...player,
    ...buildClubPlayerRatingMirror(player, record),
  };
}

export async function saveSelfDeclaredRating(authUserId, rating, options = {}) {
  if (!authUserId) {
    return { ok: false, error: "Thiếu auth user." };
  }

  const snapped = snapPickVnRating(rating);
  const now = new Date().toISOString();
  const existing = getPickVnRatingByAuthUserId(authUserId);
  const historyEntry = buildRatingHistoryEntry({
    from: existing?.currentRating ?? null,
    to: snapped,
    status: RATING_STATUS.SELF_DECLARED,
    source: options.source || "onboarding",
    at: now,
  });

  const record = normalizePickVnRatingRecord({
    id: existing?.id || buildRatingId(authUserId),
    authUserId,
    vprAthleteId: existing?.vprAthleteId || options.vprAthleteId || null,
    selfDeclaredRating: snapped,
    currentRating: snapped,
    ratingStatus: RATING_STATUS.SELF_DECLARED,
    ratingConfidence: 0.2,
    ratingMatchCount: existing?.ratingMatchCount || 0,
    lastRatingUpdatedAt: now,
    ratingHistory: [...(existing?.ratingHistory || []), historyEntry],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  upsertPickVnRating(record);
  rpcPickVnSyncRating(record).catch(() => {});

  return { ok: true, record };
}

function syncOnboardingToClubPlayer({
  clubId,
  playerId,
  authUserId,
  gender,
  birthYear,
  record,
}) {
  if (!clubId) {
    return { ok: true, changed: false };
  }

  const data = loadClubData(clubId);
  const players = data.players || [];
  const index = playerId
    ? players.findIndex((player) => String(player.id) === String(playerId))
    : players.findIndex((player) => String(player.authUserId) === String(authUserId));

  if (index < 0) {
    return { ok: true, changed: false };
  }

  const current = players[index];
  const nextPlayer = {
    ...current,
    gender: GENDER_TO_PLAYER_LABEL[gender] || current.gender || null,
    birthYear: birthYear != null ? Number(birthYear) : current.birthYear,
    ...buildClubPlayerRatingMirror(current, record),
  };

  const nextPlayers = players.map((player, idx) =>
    idx === index ? nextPlayer : player
  );
  data.players = normalizePlayers(nextPlayers);
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, changed: true };
}

export async function completePickVnOnboarding(
  authUserId,
  {
    answers = {},
    clubId = null,
    playerId = null,
    vprAthleteId = null,
    hasClub = false,
  } = {}
) {
  if (!authUserId) {
    return { ok: false, error: "Thiếu auth user." };
  }

  const existing = getPickVnRatingByAuthUserId(authUserId);
  const assessment = calculatePlayerAssessment({
    answers,
    hasClub: hasClub || Boolean(clubId),
    matchCount: existing?.ratingMatchCount || 0,
  });

  if (!assessment.ok) {
    return {
      ok: false,
      error: assessment.error || "Không tính được đánh giá.",
      missingByStep: assessment.missingByStep,
    };
  }

  const now = new Date().toISOString();
  const historyEntry = buildRatingHistoryEntry({
    from: existing?.currentRating ?? null,
    to: assessment.provisional_rating,
    status: assessment.rating_status,
    source: "onboarding_assessment_v2",
    note: `Score ${assessment.assessment_score}/100; self ${assessment.self_declared_rating}`,
    at: now,
  });

  const record = normalizePickVnRatingRecord({
    id: existing?.id || buildRatingId(authUserId),
    authUserId,
    vprAthleteId: existing?.vprAthleteId || vprAthleteId || null,
    selfDeclaredRating: assessment.self_declared_rating,
    provisionalRating: assessment.provisional_rating,
    currentRating: assessment.provisional_rating,
    suggestedRating: assessment.provisional_rating,
    assessmentAnswers: assessment.answers,
    assessmentScore: assessment.assessment_score,
    warningFlags: assessment.warning_flags,
    assessmentBreakdown: assessment.assessment_breakdown,
    externalRatingSources: assessment.external_rating_sources,
    rawProvisionalRating: assessment.raw_provisional_rating,
    ratingCalibration: assessment.rating_calibration,
    ratingStatus: assessment.rating_status,
    ratingConfidence: assessment.rating_confidence_normalized,
    ratingMatchCount: existing?.ratingMatchCount || 0,
    lastRatingUpdatedAt: now,
    ratingHistory: [...(existing?.ratingHistory || []), historyEntry],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  upsertPickVnRating(record);
  savePlayerAssessment({
    authUserId,
    ...assessment,
    recordId: record.id,
  });

  const gender = assessment.answers.gender || null;
  const birthYear = assessment.answers.birth_year ?? null;
  await updateSelfDemographics({ gender, birthYear }).catch(() => {});

  syncOnboardingToClubPlayer({
    clubId,
    playerId,
    authUserId,
    gender,
    birthYear,
    record,
  });

  return {
    ok: true,
    record,
    assessment,
  };
}

export function applyVerifiedRatingToRecord(
  record,
  {
    rating,
    status,
    verifiedBy = null,
    note = "",
    source = "verification",
    provisionalRating = null,
  } = {}
) {
  const existing = normalizePickVnRatingRecord(record);
  if (!existing) {
    return null;
  }

  const snapped = snapPickVnRating(rating);
  const now = new Date().toISOString();
  const historyEntry = buildRatingHistoryEntry({
    from: existing.currentRating,
    to: snapped,
    status,
    source,
    verifiedBy,
    note,
    at: now,
  });

  const next = normalizePickVnRatingRecord({
    ...existing,
    verifiedRating: snapped,
    provisionalRating: provisionalRating != null ? snapPickVnRating(provisionalRating) : existing.provisionalRating,
    currentRating: snapped,
    ratingStatus: status,
    ratingConfidence: Math.min(1, (existing.ratingConfidence || 0) + 0.25),
    lastRatingUpdatedAt: now,
    ratingVerifiedBy: verifiedBy,
    ratingVerificationNote: note,
    ratingHistory: [...(existing.ratingHistory || []), historyEntry],
    updatedAt: now,
  });

  upsertPickVnRating(next);
  rpcPickVnSyncRating(next).catch(() => {});
  return next;
}

export function incrementRatingMatchCount(authUserId, delta = 1) {
  const existing = getPickVnRatingByAuthUserId(authUserId);
  if (!existing) {
    return null;
  }
  const now = new Date().toISOString();
  const next = normalizePickVnRatingRecord({
    ...existing,
    ratingMatchCount: (existing.ratingMatchCount || 0) + delta,
    ratingConfidence: Math.min(
      1,
      (existing.ratingConfidence || 0) + delta * 0.05
    ),
    updatedAt: now,
  });
  upsertPickVnRating(next);
  rpcPickVnSyncRating(next).catch(() => {});
  return next;
}

export function incrementRatingMatchCountForClubPlayers(clubId, playerIds = []) {
  if (!clubId || !playerIds.length) {
    return { ok: true, changed: false, count: 0 };
  }

  const data = loadClubData(clubId);
  const targetIds = new Set(playerIds.map(String));
  let count = 0;

  const nextPlayers = (data.players || []).map((player) => {
    if (!targetIds.has(String(player.id))) {
      return player;
    }
    const authUserId = player.authUserId ? String(player.authUserId) : null;
    if (!authUserId) {
      return player;
    }
    const record = incrementRatingMatchCount(authUserId);
    if (!record) {
      return player;
    }
    count += 1;
    return syncRatingToClubPlayer(player, authUserId);
  });

  if (count > 0) {
    data.players = normalizePlayers(nextPlayers);
    data.updatedAt = new Date().toISOString();
    saveClubData(clubId, data);
  }

  return { ok: true, changed: count > 0, count };
}

export function incrementPickVnMatchCountFromRecord(clubId, record) {
  if (!record) {
    return { ok: true, changed: false, count: 0 };
  }

  const playerIds = [
    ...(record.teamAPlayerIds || []),
    ...(record.teamBPlayerIds || []),
    ...(record.playerIds || []),
  ];

  return incrementRatingMatchCountForClubPlayers(clubId, [...new Set(playerIds.map(String))]);
}

export function setProvisionalRating(authUserId, provisionalRating, options = {}) {
  const existing = getPickVnRatingByAuthUserId(authUserId);
  if (!existing) {
    return null;
  }
  const snapped = snapPickVnRating(provisionalRating);
  const now = new Date().toISOString();
  const next = normalizePickVnRatingRecord({
    ...existing,
    provisionalRating: snapped,
    ratingStatus: options.underReview
      ? RATING_STATUS.UNDER_REVIEW
      : RATING_STATUS.PROVISIONAL,
    lastRatingUpdatedAt: now,
    updatedAt: now,
  });
  upsertPickVnRating(next);
  return next;
}
