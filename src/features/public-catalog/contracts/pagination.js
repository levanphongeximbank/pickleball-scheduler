/**
 * Pagination / sort query validation (PUBLIC-CATALOG-01).
 */

import {
  PUBLIC_CATALOG_DEFAULT_LIMIT,
  PUBLIC_CATALOG_DEFAULT_OFFSET,
  PUBLIC_CATALOG_MAX_LIMIT,
  PUBLIC_CLUB_DEFAULT_SORT,
  PUBLIC_CLUB_SORT,
  PUBLIC_COURT_DEFAULT_SORT,
  PUBLIC_COURT_SORT,
} from "../constants/pagination.js";
import { PUBLIC_CATALOG_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract, isPlainObject } from "./shared.js";

/**
 * @param {unknown} raw
 * @returns {{ limit: number, offset: number }}
 */
export function normalizePaginationInput(raw) {
  const input = raw === undefined || raw === null ? {} : raw;
  if (!isPlainObject(input)) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION,
      "Pagination input must be an object",
      { field: "pagination" }
    );
  }

  let limit = PUBLIC_CATALOG_DEFAULT_LIMIT;
  if (input.limit !== undefined && input.limit !== null) {
    if (typeof input.limit !== "number" || !Number.isInteger(input.limit)) {
      failContract(
        PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION,
        "limit must be an integer",
        { field: "limit", value: input.limit }
      );
    }
    if (input.limit < 1 || input.limit > PUBLIC_CATALOG_MAX_LIMIT) {
      failContract(
        PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION,
        `limit must be between 1 and ${PUBLIC_CATALOG_MAX_LIMIT}`,
        { field: "limit", value: input.limit, max: PUBLIC_CATALOG_MAX_LIMIT }
      );
    }
    limit = input.limit;
  }

  let offset = PUBLIC_CATALOG_DEFAULT_OFFSET;
  if (input.offset !== undefined && input.offset !== null) {
    if (typeof input.offset !== "number" || !Number.isInteger(input.offset)) {
      failContract(
        PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION,
        "offset must be an integer",
        { field: "offset", value: input.offset }
      );
    }
    if (input.offset < 0) {
      failContract(
        PUBLIC_CATALOG_ERROR_CODE.INVALID_PAGINATION,
        "offset must be >= 0",
        { field: "offset", value: input.offset }
      );
    }
    offset = input.offset;
  }

  return Object.freeze({ limit, offset });
}

/**
 * @param {unknown} sort
 * @returns {string}
 */
export function normalizeClubSort(sort) {
  if (sort === undefined || sort === null || sort === "") {
    return PUBLIC_CLUB_DEFAULT_SORT;
  }
  if (sort !== PUBLIC_CLUB_SORT.NAME_ASC) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_SORT,
      "Unsupported club sort",
      { field: "sort", value: sort }
    );
  }
  return PUBLIC_CLUB_SORT.NAME_ASC;
}

/**
 * @param {unknown} sort
 * @returns {string}
 */
export function normalizeCourtSort(sort) {
  if (sort === undefined || sort === null || sort === "") {
    return PUBLIC_COURT_DEFAULT_SORT;
  }
  if (sort !== PUBLIC_COURT_SORT.NAME_ASC) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_SORT,
      "Unsupported court sort",
      { field: "sort", value: sort }
    );
  }
  return PUBLIC_COURT_SORT.NAME_ASC;
}

/**
 * @param {unknown} clubId
 * @returns {string|null}
 */
export function normalizeOptionalClubIdFilter(clubId) {
  if (clubId === undefined || clubId === null || clubId === "") return null;
  if (typeof clubId !== "string" || !clubId.trim()) {
    failContract(
      PUBLIC_CATALOG_ERROR_CODE.INVALID_FILTER,
      "clubId filter must be a non-empty string",
      { field: "clubId", value: clubId }
    );
  }
  return clubId.trim();
}
