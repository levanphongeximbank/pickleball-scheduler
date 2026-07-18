/**
 * Activity region — structured value; ranking mocks are not canonical.
 */

/**
 * @typedef {object} ActivityRegion
 * @property {string|null} countryCode
 * @property {string|null} provinceCode
 * @property {string|null} provinceName
 * @property {string|null} city
 * @property {string|null} district
 */

/**
 * @returns {ActivityRegion}
 */
export function emptyActivityRegion() {
  return {
    countryCode: null,
    provinceCode: null,
    provinceName: null,
    city: null,
    district: null,
  };
}

function nullStr(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/**
 * Normalize region from object or simple string (stored as provinceName/city hint only).
 * @param {unknown} value
 * @returns {ActivityRegion|null}
 */
export function normalizeActivityRegion(value) {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return {
      ...emptyActivityRegion(),
      provinceName: text,
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    countryCode: nullStr(value.countryCode ?? value.country_code),
    provinceCode: nullStr(value.provinceCode ?? value.province_code),
    provinceName: nullStr(value.provinceName ?? value.province_name ?? value.province),
    city: nullStr(value.city),
    district: nullStr(value.district),
  };
}

/**
 * @param {unknown} value
 */
export function validateActivityRegion(value) {
  if (value == null || value === "") {
    return { ok: true, value: null, errors: [] };
  }

  if (typeof value === "string") {
    return { ok: true, value: normalizeActivityRegion(value), errors: [] };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "INVALID_REGION_SHAPE",
          field: "activityRegion",
          message: "activityRegion must be an object or string",
        },
      ],
    };
  }

  // Reject ranking-mock-only shapes that claim canonical ranking authority
  if (value.isRankingMock === true || value.source === "ranking_mock") {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "INVALID_REGION_SHAPE",
          field: "activityRegion",
          message: "Ranking mock region data is not a canonical activityRegion",
        },
      ],
    };
  }

  const normalized = normalizeActivityRegion(value);
  return { ok: true, value: normalized, errors: [] };
}
