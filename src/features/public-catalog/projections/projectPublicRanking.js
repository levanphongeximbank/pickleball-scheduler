/**
 * Public Ranking DTO projector — deny-by-default (PUBLIC-CATALOG-02).
 */

import { PUBLIC_CLUB_PUBLICATION_STATE } from "../constants/publicationState.js";
import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { PUBLIC_RANKING_DTO_KEYS } from "../contracts/publicRankingDto.js";

export function projectPublicRanking(row) {
  if (!isPlainObject(row)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Ranking row is not projectable as public",
      { reason: "invalid_row" }
    );
  }

  const publicationState =
    row.publication_state ||
    row.publicationState ||
    PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED;

  if (publicationState !== PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Ranking publication state is not public",
      { publicationState }
    );
  }

  const rankRaw = row.rank;
  const rank =
    typeof rankRaw === "number" && Number.isInteger(rankRaw)
      ? rankRaw
      : Number.parseInt(String(rankRaw || ""), 10);
  if (!Number.isInteger(rank) || rank < 1) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Ranking rank must be a positive integer",
      { rank: rankRaw }
    );
  }

  const totalPointsRaw = row.total_points ?? row.totalPoints ?? 0;
  const totalPoints =
    typeof totalPointsRaw === "number" && Number.isInteger(totalPointsRaw)
      ? totalPointsRaw
      : Number.parseInt(String(totalPointsRaw || "0"), 10) || 0;

  const tournamentsCountRaw =
    row.tournaments_count ?? row.tournamentsCount ?? 0;
  const tournamentsCount =
    typeof tournamentsCountRaw === "number" &&
    Number.isInteger(tournamentsCountRaw)
      ? tournamentsCountRaw
      : Number.parseInt(String(tournamentsCountRaw || "0"), 10) || 0;

  const dto = {
    id: requireNonEmptyString(row.id, "id"),
    displayName: requireNonEmptyString(
      row.display_name ?? row.displayName ?? row.name,
      "displayName"
    ),
    clubName: optionalNonEmptyString(
      row.club_name ?? row.clubName,
      "clubName"
    ),
    region: optionalNonEmptyString(row.region, "region"),
    category: requireNonEmptyString(
      row.category ?? "men_single",
      "category"
    ),
    gender: optionalNonEmptyString(row.gender, "gender"),
    rank,
    totalPoints,
    tournamentsCount,
    bestPlacement: optionalNonEmptyString(
      row.best_placement ?? row.bestPlacement,
      "bestPlacement"
    ),
    publicationState: PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED,
    updatedAt: optionalNonEmptyString(
      row.updated_at ?? row.updatedAt,
      "updatedAt"
    ),
  };

  const projected = {};
  for (const key of PUBLIC_RANKING_DTO_KEYS) {
    projected[key] = dto[key];
  }
  return deepFreeze(projected);
}

export function tryProjectPublicRanking(row) {
  try {
    return { ok: true, value: projectPublicRanking(row) };
  } catch (err) {
    return { ok: false, error: err };
  }
}
