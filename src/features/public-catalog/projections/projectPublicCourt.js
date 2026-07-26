/**
 * Public Court DTO projector — deny-by-default allowlist (PUBLIC-CATALOG-01).
 */

import {
  PUBLIC_COURT_OPERATIONAL_STATE,
  PUBLIC_COURT_PUBLICATION_STATE,
  isPublicCourtType,
} from "../constants/publicationState.js";
import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { PUBLIC_COURT_DTO_KEYS } from "../contracts/publicCourtDto.js";

/**
 * @param {unknown} row
 * @returns {Readonly<{
 *   id: string,
 *   clubId: string,
 *   venueId: string,
 *   displayName: string,
 *   courtType: string|null,
 *   surface: string|null,
 *   availabilityDescriptor: string|null,
 *   publicationState: string,
 *   operationalState: string,
 * }>}
 */
export function projectPublicCourt(row) {
  if (!isPlainObject(row)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Court row is not projectable as public",
      { reason: "invalid_row" }
    );
  }

  if (row.is_publicly_listed === false || row.isPubliclyListed === false) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE,
      "Court parent club is not publicly listed",
      { courtId: row.id ?? row.court_id ?? null }
    );
  }

  const publicationState =
    row.publication_state ||
    row.publicationState ||
    PUBLIC_COURT_PUBLICATION_STATE.PUBLISHED;

  if (publicationState !== PUBLIC_COURT_PUBLICATION_STATE.PUBLISHED) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Court publication state is not public",
      { publicationState }
    );
  }

  const operationalState =
    row.operational_state ||
    row.operationalState ||
    row.status ||
    PUBLIC_COURT_OPERATIONAL_STATE.ACTIVE;

  if (operationalState !== PUBLIC_COURT_OPERATIONAL_STATE.ACTIVE) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE,
      "Non-active courts are not public",
      { operationalState }
    );
  }

  if (row.active === false) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE,
      "Inactive courts are not public",
      { courtId: row.id ?? row.court_id ?? null }
    );
  }

  const id = requireNonEmptyString(row.id ?? row.court_id, "id");
  const clubId = requireNonEmptyString(row.club_id ?? row.clubId, "clubId");
  const venueId = requireNonEmptyString(row.venue_id ?? row.venueId, "venueId");
  const displayName = requireNonEmptyString(
    row.display_name ?? row.displayName ?? row.name,
    "displayName"
  );

  const courtTypeRaw =
    row.court_type ?? row.courtType ?? null;
  let courtType = null;
  if (courtTypeRaw !== null && courtTypeRaw !== undefined && courtTypeRaw !== "") {
    if (!isPublicCourtType(courtTypeRaw)) {
      failContract(
        PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
        "Court type is not a certified public value",
        { field: "courtType", value: courtTypeRaw }
      );
    }
    courtType = courtTypeRaw;
  }

  const dto = {
    id,
    clubId,
    venueId,
    displayName,
    courtType,
    surface: optionalNonEmptyString(row.surface, "surface"),
    availabilityDescriptor: optionalNonEmptyString(
      row.availability_descriptor ?? row.availabilityDescriptor,
      "availabilityDescriptor"
    ),
    publicationState: PUBLIC_COURT_PUBLICATION_STATE.PUBLISHED,
    operationalState: PUBLIC_COURT_OPERATIONAL_STATE.ACTIVE,
  };

  const projected = {};
  for (const key of PUBLIC_COURT_DTO_KEYS) {
    projected[key] = dto[key];
  }

  return deepFreeze(projected);
}

/**
 * @param {unknown} row
 * @returns {{ ok: true, value: object } | { ok: false, error: import("../errors/PublicCatalogError.js").PublicCatalogError }}
 */
export function tryProjectPublicCourt(row) {
  try {
    return { ok: true, value: projectPublicCourt(row) };
  } catch (err) {
    return { ok: false, error: err };
  }
}
