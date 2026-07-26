/**
 * Remote public-catalog provenance — LIVE only on certified remote path.
 * MOCK is never a success provenance for remote adapters.
 */

export const PUBLIC_CATALOG_PROVENANCE = Object.freeze({
  LIVE: "LIVE",
});

export const PUBLIC_CATALOG_PROVENANCE_VALUES = Object.freeze(
  Object.values(PUBLIC_CATALOG_PROVENANCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicCatalogProvenance(value) {
  return PUBLIC_CATALOG_PROVENANCE_VALUES.includes(value);
}
