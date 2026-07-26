/**
 * Public Club DTO projector — deny-by-default allowlist (PUBLIC-CATALOG-01).
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
import { PUBLIC_CLUB_DTO_KEYS } from "../contracts/publicClubDto.js";

/**
 * Raw remote row shape (from SECURITY DEFINER RPC / repository).
 * Only public-safe columns should be present; projector still re-allowlists.
 *
 * @param {unknown} row
 * @returns {Readonly<{
 *   id: string,
 *   displayName: string,
 *   slug: string|null,
 *   description: string|null,
 *   logoUrl: string|null,
 *   imageUrl: string|null,
 *   locationSummary: string|null,
 *   publicationState: string,
 *   publicContact: string|null,
 * }>}
 */
export function projectPublicClub(row) {
  if (!isPlainObject(row)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Club row is not projectable as public",
      { reason: "invalid_row" }
    );
  }

  if (row.is_publicly_listed === false || row.isPubliclyListed === false) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE,
      "Club is not publicly listed",
      { clubId: row.id ?? row.club_id ?? null }
    );
  }

  const status = row.status ?? row.club_status ?? null;
  if (status !== null && status !== undefined && status !== "active") {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE,
      "Inactive or unpublished clubs are not public",
      { clubId: row.id ?? row.club_id ?? null, status }
    );
  }

  if (row.deleted_at || row.deletedAt) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.ARCHIVED_OR_PRIVATE,
      "Deleted clubs are not public",
      { clubId: row.id ?? row.club_id ?? null }
    );
  }

  const publicationState =
    row.publication_state ||
    row.publicationState ||
    PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED;

  if (publicationState !== PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.NOT_PUBLIC,
      "Club publication state is not public",
      { publicationState }
    );
  }

  const id = requireNonEmptyString(row.id ?? row.club_id, "id");
  const displayName = requireNonEmptyString(
    row.display_name ?? row.displayName ?? row.name,
    "displayName"
  );

  const dto = {
    id,
    displayName,
    slug: optionalNonEmptyString(row.slug ?? row.public_slug ?? row.publicSlug, "slug"),
    description: optionalNonEmptyString(
      row.description ?? row.public_description,
      "description"
    ),
    logoUrl: optionalNonEmptyString(
      row.logo_url ?? row.logoUrl ?? row.public_logo_url,
      "logoUrl"
    ),
    imageUrl: optionalNonEmptyString(
      row.image_url ?? row.imageUrl ?? row.public_cover_image_url,
      "imageUrl"
    ),
    locationSummary: optionalNonEmptyString(
      row.location_summary ??
        row.locationSummary ??
        row.public_location_summary,
      "locationSummary"
    ),
    publicationState: PUBLIC_CLUB_PUBLICATION_STATE.PUBLISHED,
    publicContact: optionalNonEmptyString(
      row.public_contact ?? row.publicContact,
      "publicContact"
    ),
  };

  // Deny-by-default: only allowlisted keys
  const projected = {};
  for (const key of PUBLIC_CLUB_DTO_KEYS) {
    projected[key] = dto[key];
  }

  return deepFreeze(projected);
}

/**
 * @param {unknown} row
 * @returns {{ ok: true, value: object } | { ok: false, error: import("../errors/PublicCatalogError.js").PublicCatalogError }}
 */
export function tryProjectPublicClub(row) {
  try {
    return { ok: true, value: projectPublicClub(row) };
  } catch (err) {
    return { ok: false, error: err };
  }
}
