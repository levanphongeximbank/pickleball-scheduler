/**
 * Team Tournament setup canonical normalization rules (schema v7).
 * Normalization and hashing only — no generation algorithms.
 */

export const CANONICAL_SCHEMA_VERSION = 7;

export const SETUP_COMMAND_NAMES = Object.freeze([
  "discipline.save",
  "discipline.remove",
  "discipline.reorder",
  "groups.replace",
  "groups.clear",
  "matchups.replace",
  "schedule.update",
  "schedule.batch",
  "schedule.publish",
  "schedule.lock",
  "deputies.set",
  "dreambreaker.order_submit",
  "dreambreaker.order_lock",
  "dreambreaker.point",
  "dreambreaker.sync",
  "awards.update",
  "awards.assign",
  "awards.auto_assign",
  "tournament.save_draft",
  "tournament.close",
  "snapshot.restore",
]);

/** @type {ReadonlySet<string>} */
export const SETUP_COMMAND_REGISTRY = new Set(SETUP_COMMAND_NAMES);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CanonicalValidationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "CanonicalValidationError";
    this.code = code;
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCanonicalString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().normalize("NFC");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCanonicalUuidString(value) {
  const normalized = normalizeCanonicalString(value);
  if (!normalized) {
    return "";
  }
  if (UUID_PATTERN.test(normalized)) {
    return normalized.toLowerCase();
  }
  return normalized;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeCanonicalDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new CanonicalValidationError("INVALID_DATE", "Timestamp không hợp lệ.");
  }
  return date.toISOString();
}

/**
 * @param {unknown} value
 * @param {{ rating?: boolean }} [options]
 * @returns {number}
 */
export function normalizeCanonicalNumber(value, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new CanonicalValidationError("INVALID_NUMBER", "Số không hợp lệ.");
  }
  if (options.rating) {
    return Math.round(numeric * 100) / 100;
  }
  if (Number.isInteger(numeric)) {
    return numeric;
  }
  return numeric;
}

/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function canonicalizeValue(value, seen = new WeakSet()) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const valueType = typeof value;
  if (valueType === "function" || valueType === "symbol") {
    throw new CanonicalValidationError("UNSUPPORTED_TYPE", `Kiểu ${valueType} không được hỗ trợ.`);
  }
  if (valueType === "bigint") {
    throw new CanonicalValidationError("UNSUPPORTED_TYPE", "BigInt không được hỗ trợ.");
  }
  if (valueType === "boolean") {
    return value;
  }
  if (valueType === "number") {
    return normalizeCanonicalNumber(value);
  }
  if (valueType === "string") {
    const normalized = normalizeCanonicalString(value);
    if (UUID_PATTERN.test(normalized)) {
      return normalized.toLowerCase();
    }
    return normalized;
  }

  if (value instanceof Date) {
    return normalizeCanonicalDate(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const canonical = canonicalizeValue(item, seen);
      return canonical === undefined ? null : canonical;
    });
  }

  if (valueType === "object") {
    if (seen.has(value)) {
      throw new CanonicalValidationError("CYCLIC_REFERENCE", "Phát hiện tham chiếu vòng.");
    }
    seen.add(value);

    const result = Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        const canonical = canonicalizeValue(value[key], seen);
        if (canonical === undefined) {
          return accumulator;
        }
        accumulator[key] = canonical;
        return accumulator;
      }, {});

    seen.delete(value);
    return result;
  }

  throw new CanonicalValidationError("UNSUPPORTED_TYPE", `Kiểu ${valueType} không được hỗ trợ.`);
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareStrings(left, right) {
  return String(left).localeCompare(String(right));
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function uniqueSortedIds(values = []) {
  return [...new Set(values.map((value) => normalizeCanonicalUuidString(value)).filter(Boolean))].sort(
    compareStrings
  );
}

/**
 * @param {unknown} leftAt
 * @param {unknown} rightAt
 * @returns {number}
 */
function compareScheduledAt(leftAt, rightAt) {
  const left = leftAt ? new Date(String(leftAt)).getTime() : Number.POSITIVE_INFINITY;
  const right = rightAt ? new Date(String(rightAt)).getTime() : Number.POSITIVE_INFINITY;
  if (left !== right) {
    return left - right;
  }
  return 0;
}

/**
 * @param {string} domain
 * @param {unknown[]} items
 * @returns {unknown[]}
 */
export function canonicalizeDomainCollection(domain, items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const canonicalItems = items.map((item) => canonicalizeValue(item));

  switch (domain) {
    case "teams":
      return [...canonicalItems].sort((left, right) => compareStrings(left.id, right.id));
    case "rosterMembers":
      return [...canonicalItems].sort((left, right) => compareStrings(left.playerId, right.playerId));
    case "disciplines":
      return [...canonicalItems].sort((left, right) => {
        const orderDiff = Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return compareStrings(left.id, right.id);
      });
    case "groups":
      return [...canonicalItems]
        .sort((left, right) => {
          const orderDiff = Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
          if (orderDiff !== 0) {
            return orderDiff;
          }
          return compareStrings(left.id, right.id);
        })
        .map((group) => ({
          ...group,
          teamIds: uniqueSortedIds(group.teamIds),
        }));
    case "matchups":
      return [...canonicalItems].sort((left, right) => {
        const scheduleDiff = compareScheduledAt(left.scheduledAt, right.scheduledAt);
        if (scheduleDiff !== 0) {
          return scheduleDiff;
        }
        return compareStrings(left.id, right.id);
      });
    case "subMatches":
      return [...canonicalItems].sort((left, right) => {
        const matchupDiff = compareStrings(left.matchupId, right.matchupId);
        if (matchupDiff !== 0) {
          return matchupDiff;
        }
        const orderDiff = Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return compareStrings(left.id, right.id);
      });
    case "schedule":
      return [...canonicalItems].sort((left, right) => {
        const scheduleDiff = compareScheduledAt(left.scheduledAt, right.scheduledAt);
        if (scheduleDiff !== 0) {
          return scheduleDiff;
        }
        return compareStrings(left.matchupId, right.matchupId);
      });
    case "deputies":
      return [...canonicalItems]
        .sort((left, right) => compareStrings(left.teamId, right.teamId))
        .map((entry) => ({
          ...entry,
          deputyPlayerIds: uniqueSortedIds(entry.deputyPlayerIds),
        }));
    case "teamPlayerIds":
      return uniqueSortedIds(items);
    default:
      return canonicalItems;
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function stableCanonicalStringify(value) {
  const canonical = canonicalizeValue(value ?? null);
  return JSON.stringify(canonical);
}

/**
 * @param {Record<string, unknown>} awards
 * @returns {Record<string, unknown>}
 */
export function canonicalizeAwardsObject(awards = {}) {
  const canonical = canonicalizeValue(awards);
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical)) {
    return {};
  }
  return Object.keys(canonical)
    .sort()
    .reduce((accumulator, key) => {
      accumulator[key] = canonical[key];
      return accumulator;
    }, {});
}
