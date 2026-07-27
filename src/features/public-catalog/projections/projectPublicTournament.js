/**
 * Public Tournament DTO projector — deny-by-default (PUBLIC-CATALOG-02).
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
import { PUBLIC_TOURNAMENT_DTO_KEYS } from "../contracts/publicTournamentDto.js";

const OPS = new Set(["upcoming", "live", "finished"]);

export function projectPublicTournament(row) {
  if (!isPlainObject(row)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Tournament row is not projectable as public",
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
      "Tournament publication state is not public",
      { publicationState }
    );
  }

  const operationalStatus = String(
    row.operational_status || row.operationalStatus || "upcoming"
  );
  if (!OPS.has(operationalStatus)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Tournament operational status is not public-safe",
      { operationalStatus }
    );
  }

  const id = requireNonEmptyString(row.id, "id");
  const displayName = requireNonEmptyString(
    row.display_name ?? row.displayName ?? row.name,
    "displayName"
  );

  const dto = {
    id,
    displayName,
    slug: optionalNonEmptyString(row.slug, "slug"),
    sport: optionalNonEmptyString(row.sport, "sport") || "pickleball",
    publicationState: PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED,
    operationalStatus,
    startDate: optionalNonEmptyString(
      row.start_date ?? row.startDate,
      "startDate"
    ),
    endDate: optionalNonEmptyString(row.end_date ?? row.endDate, "endDate"),
    locationSummary: optionalNonEmptyString(
      row.location_summary ?? row.locationSummary,
      "locationSummary"
    ),
    formatSummary: optionalNonEmptyString(
      row.format_summary ?? row.formatSummary,
      "formatSummary"
    ),
    categorySummary: optionalNonEmptyString(
      row.category_summary ?? row.categorySummary,
      "categorySummary"
    ),
    imageUrl: optionalNonEmptyString(
      row.image_url ?? row.imageUrl,
      "imageUrl"
    ),
    updatedAt: optionalNonEmptyString(
      row.updated_at ?? row.updatedAt,
      "updatedAt"
    ),
  };

  const projected = {};
  for (const key of PUBLIC_TOURNAMENT_DTO_KEYS) {
    projected[key] = dto[key];
  }
  return deepFreeze(projected);
}

export function tryProjectPublicTournament(row) {
  try {
    return { ok: true, value: projectPublicTournament(row) };
  } catch (err) {
    return { ok: false, error: err };
  }
}
