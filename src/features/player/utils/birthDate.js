/**
 * Birth date / year / age-group helpers.
 *
 * Rules:
 * - birthDate: YYYY-MM-DD or null; never invent from birthYear
 * - birthYear: int or null; may derive from birthDate on read
 * - ageGroup: derived read-only; reference date documented
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reference date for ageGroup derivation (calendar day in local computation).
 * Tests may override via options.referenceDate.
 * @param {Date|string|null|undefined} referenceDate
 * @returns {Date}
 */
export function resolveAgeReferenceDate(referenceDate) {
  if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
    return referenceDate;
  }
  if (typeof referenceDate === "string" && referenceDate.trim()) {
    const d = parseIsoDateOnly(referenceDate.trim());
    if (d) return d;
  }
  // Use UTC noon to reduce TZ off-by-one when only date is needed
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
}

/**
 * @param {string} iso
 * @returns {Date|null}
 */
export function parseIsoDateOnly(iso) {
  const m = ISO_DATE_RE.exec(String(iso || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null; // impossible calendar date (e.g. 2023-02-30)
  }
  return dt;
}

/**
 * @param {unknown} value
 * @returns {{ ok: boolean, value: string|null, errors: object[] }}
 */
export function validateBirthDate(value, options = {}) {
  if (value == null || value === "") {
    return { ok: true, value: null, errors: [] };
  }
  const raw = String(value).trim();
  if (!ISO_DATE_RE.test(raw)) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "INVALID_BIRTH_DATE_FORMAT",
          field: "birthDate",
          message: "birthDate must be YYYY-MM-DD",
        },
      ],
    };
  }
  const parsed = parseIsoDateOnly(raw);
  if (!parsed) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "IMPOSSIBLE_BIRTH_DATE",
          field: "birthDate",
          message: `Impossible calendar date: ${raw}`,
        },
      ],
    };
  }
  const ref = resolveAgeReferenceDate(options.referenceDate);
  if (parsed.getTime() > ref.getTime()) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "FUTURE_BIRTH_DATE",
          field: "birthDate",
          message: "birthDate cannot be in the future",
        },
      ],
    };
  }
  return { ok: true, value: raw, errors: [] };
}

/**
 * @param {unknown} value
 */
export function validateBirthYear(value, options = {}) {
  if (value == null || value === "") {
    return { ok: true, value: null, errors: [] };
  }
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "INVALID_BIRTH_YEAR",
          field: "birthYear",
          message: "birthYear must be an integer",
        },
      ],
    };
  }
  const ref = resolveAgeReferenceDate(options.referenceDate);
  const maxYear = ref.getUTCFullYear();
  if (n < 1900 || n > maxYear) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: "INVALID_BIRTH_YEAR",
          field: "birthYear",
          message: `birthYear out of range: ${n}`,
        },
      ],
    };
  }
  return { ok: true, value: n, errors: [] };
}

/**
 * Detect conflict: birthDate year !== birthYear when both present.
 * @param {string|null} birthDate
 * @param {number|null} birthYear
 */
export function validateBirthDateYearConsistency(birthDate, birthYear) {
  if (!birthDate || birthYear == null) {
    return { ok: true, errors: [] };
  }
  const parsed = parseIsoDateOnly(birthDate);
  if (!parsed) return { ok: true, errors: [] };
  if (parsed.getUTCFullYear() !== birthYear) {
    return {
      ok: false,
      errors: [
        {
          code: "BIRTH_DATE_YEAR_CONFLICT",
          field: "birthDate",
          message: `birthDate year ${parsed.getUTCFullYear()} conflicts with birthYear ${birthYear}`,
        },
      ],
    };
  }
  return { ok: true, errors: [] };
}

/**
 * Derive birthYear from birthDate for reads — never invent birthDate from year.
 * @param {string|null} birthDate
 * @param {number|null} birthYear
 */
export function deriveBirthYearForRead(birthDate, birthYear) {
  if (birthDate) {
    const parsed = parseIsoDateOnly(birthDate);
    if (parsed) return parsed.getUTCFullYear();
  }
  return birthYear ?? null;
}

/**
 * Derive age in full years from birthDate or birthYear.
 * Reference: resolveAgeReferenceDate (UTC calendar day).
 *
 * ageGroup bands (Phase 1C product default):
 * - U12, U14, U16, U18, Open (18+)
 * Returns null when insufficient context.
 *
 * @param {{ birthDate?: string|null, birthYear?: number|null, referenceDate?: Date|string }} input
 * @returns {string|null}
 */
export function deriveAgeGroup(input = {}) {
  const ref = resolveAgeReferenceDate(input.referenceDate);
  let age = null;

  if (input.birthDate) {
    const birth = parseIsoDateOnly(input.birthDate);
    if (birth) {
      age = ref.getUTCFullYear() - birth.getUTCFullYear();
      const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
      if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
        age -= 1;
      }
    }
  } else if (input.birthYear != null && Number.isInteger(Number(input.birthYear))) {
    // Year-only: approximate age as referenceYear - birthYear (conservative band)
    age = ref.getUTCFullYear() - Number(input.birthYear);
  }

  if (age == null || age < 0 || age > 120) return null;
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 18) return "U18";
  return "Open";
}
