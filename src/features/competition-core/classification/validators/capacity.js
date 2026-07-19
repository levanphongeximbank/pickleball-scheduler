import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  classificationError,
  classificationFail,
  classificationOk,
} from "../errors/classificationError.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";
import { createDivisionCategoryCapacity } from "../contracts/capacity.js";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Validate authoritative DivisionCategory capacity metadata.
 * quotaByParticipantType is HARD capacity — sum must not exceed maxEntries when set.
 *
 * Does not allocate registrations.
 *
 * @param {Partial<import('../contracts/capacity.js').DivisionCategoryCapacity>|null|undefined} raw
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function validateDivisionCategoryCapacity(raw) {
  const errors = [];

  if (
    raw?.quotaByParticipantType &&
    typeof raw.quotaByParticipantType === "object" &&
    !Array.isArray(raw.quotaByParticipantType)
  ) {
    for (const [rawKey, rawValue] of Object.entries(raw.quotaByParticipantType)) {
      const keyResult = normalizeClassificationCode(rawKey);
      if (!keyResult.ok) {
        errors.push(
          classificationError(
            CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
            "capacity.quotaByParticipantType",
            "quota participant-type key is invalid",
            { key: rawKey }
          )
        );
        continue;
      }
      if (!isNonNegativeInteger(rawValue)) {
        errors.push(
          classificationError(
            CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
            `capacity.quotaByParticipantType.${keyResult.value}`,
            "quota value must be a non-negative integer",
            { key: keyResult.value, value: rawValue }
          )
        );
      }
    }
  }

  const capacity = createDivisionCategoryCapacity(raw || {});

  for (const field of /** @type {const} */ ([
    "maxEntries",
    "maxWaitlist",
    "minEntriesToRun",
  ])) {
    const value = capacity[field];
    if (value == null) continue;
    if (!Number.isInteger(value)) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
          `capacity.${field}`,
          `${field} must be an integer when provided`,
          { value }
        )
      );
      continue;
    }
    if (value < 0) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
          `capacity.${field}`,
          `${field} must not be negative`,
          { value }
        )
      );
    }
  }

  if (
    capacity.minEntriesToRun != null &&
    capacity.maxEntries != null &&
    Number.isInteger(capacity.minEntriesToRun) &&
    Number.isInteger(capacity.maxEntries) &&
    capacity.minEntriesToRun > capacity.maxEntries
  ) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
        "capacity.minEntriesToRun",
        "minEntriesToRun must not exceed maxEntries",
        {
          minEntriesToRun: capacity.minEntriesToRun,
          maxEntries: capacity.maxEntries,
        }
      )
    );
  }

  const quotas = capacity.quotaByParticipantType;
  if (quotas && !errors.some((e) => e.path.startsWith("capacity.quotaByParticipantType"))) {
    let quotaSum = 0;
    for (const value of Object.values(quotas)) {
      if (isNonNegativeInteger(value)) {
        quotaSum += value;
      }
    }

    if (
      capacity.maxEntries != null &&
      Number.isInteger(capacity.maxEntries) &&
      capacity.maxEntries >= 0 &&
      quotaSum > capacity.maxEntries
    ) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
          "capacity.quotaByParticipantType",
          "Sum of hard quotas must not exceed maxEntries",
          { quotaSum, maxEntries: capacity.maxEntries }
        )
      );
    }
  }

  return errors.length ? classificationFail(errors) : classificationOk(capacity);
}

/**
 * Enforce authoritative DivisionCategory capacity for registration acceptance.
 * Usage counts must be non-negative integers.
 *
 * @param {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory} lane
 * @param {{
 *   currentEntryCount: number,
 *   currentWaitlistCount?: number,
 *   participantType?: string|null,
 *   currentQuotaCounts?: Record<string, number>,
 * }} usage
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function enforceDivisionCategoryCapacity(lane, usage) {
  const shape = validateDivisionCategoryCapacity(lane?.capacity);
  if (!shape.ok) {
    return shape;
  }
  const capacity = /** @type {import('../contracts/capacity.js').DivisionCategoryCapacity} */ (
    shape.value
  );

  const entryCount = usage?.currentEntryCount;
  const waitlistCount = usage?.currentWaitlistCount ?? 0;

  if (!isNonNegativeInteger(entryCount)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
        "currentEntryCount",
        "currentEntryCount must be a non-negative integer",
        { value: entryCount }
      ),
    ]);
  }
  if (!isNonNegativeInteger(waitlistCount)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
        "currentWaitlistCount",
        "currentWaitlistCount must be a non-negative integer",
        { value: waitlistCount }
      ),
    ]);
  }

  if (capacity.maxEntries != null && entryCount >= capacity.maxEntries) {
    if (capacity.maxWaitlist != null && waitlistCount < capacity.maxWaitlist) {
      return classificationOk({ disposition: "waitlist" });
    }
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.CAPACITY_REACHED,
        "capacity.maxEntries",
        "DivisionCategory registration capacity reached",
        {
          maxEntries: capacity.maxEntries,
          currentEntryCount: entryCount,
          maxWaitlist: capacity.maxWaitlist,
          currentWaitlistCount: waitlistCount,
        }
      ),
    ]);
  }

  const participantType =
    usage?.participantType != null ? String(usage.participantType) : null;
  if (participantType && capacity.quotaByParticipantType) {
    const typeKey = normalizeClassificationCode(participantType);
    if (typeKey.ok) {
      const maxQuota = capacity.quotaByParticipantType[/** @type {string} */ (typeKey.value)];
      if (maxQuota != null) {
        const currentQuota = usage?.currentQuotaCounts?.[/** @type {string} */ (typeKey.value)];
        if (currentQuota != null && !isNonNegativeInteger(currentQuota)) {
          return classificationFail([
            classificationError(
              CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY,
              "currentQuotaCounts",
              "quota count must be a non-negative integer",
              { participantType: typeKey.value, value: currentQuota }
            ),
          ]);
        }
        const count = currentQuota == null ? 0 : currentQuota;
        if (count >= maxQuota) {
          return classificationFail([
            classificationError(
              CLASSIFICATION_ERROR_CODE.CAPACITY_REACHED,
              "capacity.quotaByParticipantType",
              "DivisionCategory hard quota reached for participant type",
              { participantType: typeKey.value, maxQuota, currentQuota: count }
            ),
          ]);
        }
      }
    }
  }

  return classificationOk({ disposition: "accept" });
}
