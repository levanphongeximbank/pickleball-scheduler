import { snapPickVnRating } from "../constants/pickVnRatingScale.js";
import { GENDER_TO_PLAYER_LABEL } from "../../player-rating/playerSkillAssessmentConfig.js";
import { calculatePlayerAssessment } from "../../player-rating/playerSkillAssessmentEngine.js";
import {
  getPlayerAssessmentByAuthUserId,
  savePlayerAssessment,
} from "../../player-rating/playerRatingAssessmentLocalStore.js";
import { RATING_STATUS } from "../constants/ratingStatus.js";
import {
  buildClubPlayerRatingMirror,
  normalizePickVnRatingRecord,
} from "../models/pickVnRating.js";
import {
  findPickVnRatingByAuthUserId,
  listPickVnRatings,
} from "../storage/pickVnRatingLocalStore.js";
import {
  durableUnavailableResult,
  frozenWriterResult,
  runCanonicalRatingWrite,
} from "./playerRatingCanonicalBridge.js";

/**
 * Read compatibility — local mirror / cache only. Not writable SSOT.
 */
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

/**
 * Onboarding gate uses assessment draft store (local-only, not rating SSOT).
 */
export function hasCompletedPickVnOnboarding(authUserId) {
  if (!authUserId) return false;
  const draft = getPlayerAssessmentByAuthUserId(authUserId);
  if (
    draft &&
    draft.answers &&
    typeof draft.answers === "object" &&
    Object.keys(draft.answers).length > 0 &&
    (draft.assessment_score != null ||
      draft.provisional_rating != null ||
      draft.ok === true)
  ) {
    return true;
  }

  // Compatibility read of legacy local mirror if present (not authority).
  const record = getPickVnRatingByAuthUserId(authUserId);
  if (!record) return false;
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

/**
 * Canonical self-declared rating mutation — writer frozen / durable-only.
 * Does not write local rating state then report success.
 */
export async function saveSelfDeclaredRating(authUserId, rating, options = {}) {
  if (!authUserId) {
    return { ok: false, error: "Thiếu auth user." };
  }

  const snapped = snapPickVnRating(rating);
  const playerId = options.playerId ? String(options.playerId) : null;

  if (!playerId || !options.actor || options.expectedVersion == null) {
    return frozenWriterResult("saveSelfDeclaredRating", {
      authUserId,
      rating: snapped,
      reason:
        "Requires canonical playerId, actor context, and expectedVersion via write facade",
    });
  }

  return runCanonicalRatingWrite(
    (facade) =>
      facade.adjust({
        playerId,
        scope: options.scope || { kind: "tenant", tenantId: options.tenantId || options.clubId },
        ratingMode: options.ratingMode || "overall",
        targetField: "selfAssessedRating",
        newValue: snapped,
        expectedVersion: options.expectedVersion,
        actor: options.actor,
        auditId: options.auditId || `audit-self-${options.actor.operationId}`,
        status: RATING_STATUS.SELF_DECLARED,
      }),
    "saveSelfDeclaredRating"
  );
}

/**
 * Assessment draft remains local-only. Canonical rating persistence is separate
 * and fail-closed when durable runtime is unavailable.
 */
export async function completePickVnOnboarding(
  authUserId,
  {
    answers = {},
    clubId = null,
    playerId = null,
    vprAthleteId = null,
    hasClub = false,
    actor = null,
    scope = null,
    expectedVersion = null,
    ratingMode = "overall",
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

  // Draft/local-only — not canonical Player Rating SSOT.
  const draft = savePlayerAssessment({
    authUserId,
    ...assessment,
    vprAthleteId: vprAthleteId || null,
    clubId: clubId || null,
    playerId: playerId || null,
    draftOnly: true,
    canonicalRatingPersisted: false,
  });

  let ratingWrite = durableUnavailableResult("completePickVnOnboarding.rating", {
    draftOnly: true,
  });

  if (playerId && actor && expectedVersion != null && scope) {
    ratingWrite = await runCanonicalRatingWrite(
      (facade) =>
        facade.adjust({
          playerId: String(playerId),
          scope,
          ratingMode,
          targetField: "provisionalRating",
          newValue: assessment.provisional_rating,
          expectedVersion,
          actor,
          auditId: `audit-onboarding-${actor.operationId}`,
          status: assessment.rating_status,
        }),
      "completePickVnOnboarding.rating"
    );
  }

  return {
    ok: true,
    draftOnly: true,
    assessment,
    assessmentDraft: draft,
    // Compatibility: no local rating SSOT record is written on success.
    record: null,
    ratingWrite,
    clubId,
    playerId,
    genderLabel: GENDER_TO_PLAYER_LABEL[assessment.answers?.gender] || null,
  };
}

/**
 * Verified rating mutation — frozen unless delegated to canonical facade.
 */
export function applyVerifiedRatingToRecord(record, options = {}) {
  void record;
  void options;
  return null;
}

export async function applyVerifiedRatingToRecordAsync(record, options = {}) {
  if (!options.playerId || !options.actor || options.expectedVersion == null) {
    return frozenWriterResult("applyVerifiedRatingToRecord", {
      reason: "Requires canonical playerId, actor, expectedVersion",
    });
  }

  const snapped = snapPickVnRating(options.rating);
  return runCanonicalRatingWrite(
    (facade) =>
      facade.verify({
        playerId: String(options.playerId),
        scope:
          options.scope ||
          { kind: "tenant", tenantId: options.tenantId || options.clubId },
        ratingMode: options.ratingMode || "overall",
        verifiedRating: snapped,
        expectedVersion: options.expectedVersion,
        actor: options.actor,
        status: options.status,
      }),
    "applyVerifiedRatingToRecord"
  );
}

export function incrementRatingMatchCount(authUserId, delta = 1) {
  void authUserId;
  void delta;
  // Rating confidence / match-count mutation is a competing writer — frozen.
  return null;
}

export function incrementRatingMatchCountForClubPlayers(clubId, playerIds = []) {
  void clubId;
  void playerIds;
  return frozenWriterResult("incrementRatingMatchCountForClubPlayers", {
    reason: "Club blob is mirror-only; match-count is not a local rating writer",
  });
}

export function incrementPickVnMatchCountFromRecord(clubId, record) {
  void clubId;
  void record;
  return frozenWriterResult("incrementPickVnMatchCountFromRecord", {
    reason: "Club blob is mirror-only; match-count is not a local rating writer",
  });
}

export function setProvisionalRating(authUserId, provisionalRating, options = {}) {
  void authUserId;
  void provisionalRating;
  void options;
  return null;
}

export async function setProvisionalRatingAsync(
  authUserId,
  provisionalRating,
  options = {}
) {
  void authUserId;
  if (!options.playerId || !options.actor || options.expectedVersion == null) {
    return frozenWriterResult("setProvisionalRating", {
      reason: "Requires canonical playerId, actor, expectedVersion",
    });
  }

  const snapped = snapPickVnRating(provisionalRating);
  return runCanonicalRatingWrite(
    (facade) =>
      facade.adjust({
        playerId: String(options.playerId),
        scope:
          options.scope ||
          { kind: "tenant", tenantId: options.tenantId || options.clubId },
        ratingMode: options.ratingMode || "overall",
        targetField: "provisionalRating",
        newValue: snapped,
        expectedVersion: options.expectedVersion,
        actor: options.actor,
        auditId: options.auditId || `audit-prov-${options.actor.operationId}`,
        status: options.underReview
          ? RATING_STATUS.UNDER_REVIEW
          : RATING_STATUS.PROVISIONAL,
      }),
    "setProvisionalRating"
  );
}
