/**
 * Hard pagination bounds for PUBLIC-CATALOG-01 remote reads.
 */

export const PUBLIC_CATALOG_DEFAULT_LIMIT = 20;
export const PUBLIC_CATALOG_MAX_LIMIT = 50;
export const PUBLIC_CATALOG_DEFAULT_OFFSET = 0;

export const PUBLIC_CLUB_SORT = Object.freeze({
  NAME_ASC: "name_asc",
});

export const PUBLIC_COURT_SORT = Object.freeze({
  NAME_ASC: "name_asc",
});

export const PUBLIC_CLUB_DEFAULT_SORT = PUBLIC_CLUB_SORT.NAME_ASC;
export const PUBLIC_COURT_DEFAULT_SORT = PUBLIC_COURT_SORT.NAME_ASC;
