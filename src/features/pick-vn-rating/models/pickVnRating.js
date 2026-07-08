import {
  formatPickVnRating,
  migrateLegacyRating,
  parsePickVnRating,
  PICK_VN_MIN,
  snapPickVnRating,
} from "../constants/pickVnRatingScale.js";
import {
  RATING_STATUS,
  isValidRatingStatus,
  normalizeRatingStatus,
} from "../constants/ratingStatus.js";

function toConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return {
    at: entry.at ? String(entry.at) : null,
    from: entry.from != null ? parsePickVnRating(entry.from) : null,
    to: entry.to != null ? parsePickVnRating(entry.to) : null,
    status: normalizeRatingStatus(entry.status, RATING_STATUS.SELF_DECLARED),
    source: entry.source ? String(entry.source) : "",
    verifiedBy: entry.verifiedBy ? String(entry.verifiedBy) : null,
    note: entry.note ? String(entry.note) : "",
  };
}

export function normalizePickVnRatingRecord(record) {
  if (!record || !record.id) {
    return null;
  }

  const currentRating = snapPickVnRating(
    record.currentRating ?? record.current_rating ?? PICK_VN_MIN
  );

  return {
    id: String(record.id),
    authUserId: record.authUserId ? String(record.authUserId) : null,
    vprAthleteId: record.vprAthleteId ? String(record.vprAthleteId) : null,
    selfDeclaredRating:
      record.selfDeclaredRating != null
        ? snapPickVnRating(record.selfDeclaredRating)
        : record.self_declared_rating != null
          ? snapPickVnRating(record.self_declared_rating)
          : null,
    provisionalRating:
      record.provisionalRating != null
        ? snapPickVnRating(record.provisionalRating)
        : record.provisional_rating != null
          ? snapPickVnRating(record.provisional_rating)
          : null,
    verifiedRating:
      record.verifiedRating != null
        ? snapPickVnRating(record.verifiedRating)
        : record.verified_rating != null
          ? snapPickVnRating(record.verified_rating)
          : null,
    currentRating,
    ratingStatus: normalizeRatingStatus(
      record.ratingStatus ?? record.rating_status,
      RATING_STATUS.UNRATED
    ),
    ratingConfidence: toConfidence(record.ratingConfidence ?? record.rating_confidence),
    ratingMatchCount: Math.max(
      0,
      Number(record.ratingMatchCount ?? record.rating_match_count) || 0
    ),
    lastRatingUpdatedAt:
      record.lastRatingUpdatedAt || record.last_rating_updated_at || null,
    ratingVerifiedBy: record.ratingVerifiedBy || record.rating_verified_by || null,
    ratingVerificationNote:
      record.ratingVerificationNote || record.rating_verification_note || "",
    ratingHistory: Array.isArray(record.ratingHistory)
      ? record.ratingHistory.map(normalizeHistoryEntry).filter(Boolean).slice(-48)
      : Array.isArray(record.rating_history)
        ? record.rating_history.map(normalizeHistoryEntry).filter(Boolean).slice(-48)
        : [],
    assessmentAnswers:
      record.assessmentAnswers && typeof record.assessmentAnswers === "object"
        ? record.assessmentAnswers
        : record.assessment_answers && typeof record.assessment_answers === "object"
          ? record.assessment_answers
          : null,
    suggestedRating:
      record.suggestedRating != null
        ? snapPickVnRating(record.suggestedRating)
        : record.suggested_rating != null
          ? snapPickVnRating(record.suggested_rating)
          : null,
    assessmentScore:
      record.assessmentScore != null
        ? Number(record.assessmentScore)
        : record.assessment_score != null
          ? Number(record.assessment_score)
          : null,
    warningFlags: Array.isArray(record.warningFlags)
      ? record.warningFlags.map(String)
      : Array.isArray(record.warning_flags)
        ? record.warning_flags.map(String)
        : [],
    assessmentBreakdown:
      record.assessmentBreakdown && typeof record.assessmentBreakdown === "object"
        ? record.assessmentBreakdown
        : record.assessment_breakdown && typeof record.assessment_breakdown === "object"
          ? record.assessment_breakdown
          : null,
    externalRatingSources:
      record.externalRatingSources && typeof record.externalRatingSources === "object"
        ? record.externalRatingSources
        : record.external_rating_sources && typeof record.external_rating_sources === "object"
          ? record.external_rating_sources
          : null,
    rawProvisionalRating:
      record.rawProvisionalRating != null
        ? snapPickVnRating(record.rawProvisionalRating)
        : record.raw_provisional_rating != null
          ? snapPickVnRating(record.raw_provisional_rating)
          : null,
    ratingCalibration:
      record.ratingCalibration != null
        ? Number(record.ratingCalibration)
        : record.rating_calibration != null
          ? Number(record.rating_calibration)
          : null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

/** Đồng bộ flat fields lên club player mirror */
export function buildClubPlayerRatingMirror(player, ratingRecord = null) {
  const legacyLevel = migrateLegacyRating(
    player?.current_rating ?? player?.skillLevel ?? player?.level ?? player?.rating
  );
  const record = ratingRecord
    ? normalizePickVnRatingRecord(ratingRecord)
    : null;

  const currentRating = snapPickVnRating(
    record?.currentRating ?? player?.current_rating ?? legacyLevel
  );
  const status =
    record?.ratingStatus ??
    player?.rating_status ??
    (player?.skillLevelLockedAt ? RATING_STATUS.SELF_DECLARED : RATING_STATUS.UNRATED);

  return {
    self_declared_rating:
      record?.selfDeclaredRating ?? player?.self_declared_rating ?? null,
    provisional_rating: record?.provisionalRating ?? player?.provisional_rating ?? null,
    verified_rating: record?.verifiedRating ?? player?.verified_rating ?? null,
    current_rating: currentRating,
    rating_status: normalizeRatingStatus(status),
    rating_confidence:
      record?.ratingConfidence ?? player?.rating_confidence ?? 0,
    rating_match_count:
      record?.ratingMatchCount ?? player?.rating_match_count ?? 0,
    last_rating_updated_at:
      record?.lastRatingUpdatedAt ?? player?.last_rating_updated_at ?? null,
    rating_verified_by:
      record?.ratingVerifiedBy ?? player?.rating_verified_by ?? null,
    rating_verification_note:
      record?.ratingVerificationNote ?? player?.rating_verification_note ?? "",
    skillLevel: currentRating,
    level: currentRating,
    rating: currentRating,
  };
}

/** Migrate player blob cũ sang Pick_VN fields */
export function migratePlayerRatingFields(player) {
  if (!player) {
    return null;
  }

  if (player.current_rating != null && player.rating_status) {
    return buildClubPlayerRatingMirror(player);
  }

  const legacyLevel = migrateLegacyRating(
    player.skillLevel ?? player.level ?? player.rating ?? 3.5
  );
  let status = RATING_STATUS.UNRATED;

  if (player.skillLevelLockedAt || player.skillLevel != null) {
    status = RATING_STATUS.SELF_DECLARED;
  }

  return buildClubPlayerRatingMirror({
    ...player,
    current_rating: legacyLevel,
    self_declared_rating: legacyLevel,
    rating_status: status,
    rating_confidence: status === RATING_STATUS.SELF_DECLARED ? 0.2 : 0,
    last_rating_updated_at:
      player.last_rating_updated_at ||
      player.skillMeta?.lastPublicLevelReviewAt ||
      player.skillLevelLockedAt ||
      null,
  });
}

export function buildRatingHistoryEntry({
  from,
  to,
  status,
  source = "",
  verifiedBy = null,
  note = "",
  at = new Date().toISOString(),
}) {
  return normalizeHistoryEntry({
    at,
    from,
    to,
    status,
    source,
    verifiedBy,
    note,
  });
}

export function formatRatingSummary(record) {
  const normalized = normalizePickVnRatingRecord(record);
  if (!normalized) {
    return null;
  }
  return {
    current: formatPickVnRating(normalized.currentRating),
    status: normalized.ratingStatus,
    confidence: normalized.ratingConfidence,
    matchCount: normalized.ratingMatchCount,
  };
}
