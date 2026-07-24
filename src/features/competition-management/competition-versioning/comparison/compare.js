/**
 * CM-03 version comparison — typed field differences, deterministic ordering.
 */

import { COMPETITION_VERSION_CHANGE_TYPE } from "../constants/versioning.js";
import { COMPETITION_VERSION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  deepFreeze,
  clonePlain,
  compareFieldPath,
  isNonEmptyString,
  canonicalizeJson,
} from "../contracts/shared.js";
import { isCompetitionVersion } from "../contracts/snapshot.js";

/**
 * @typedef {Object} CompetitionVersionDifference
 * @property {string} path
 * @property {string} changeType
 * @property {*} before
 * @property {*} after
 */

/**
 * @typedef {Object} CompetitionVersionComparisonResult
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} leftVersionId
 * @property {string} rightVersionId
 * @property {boolean} equal
 * @property {readonly CompetitionVersionDifference[]} differences
 * @property {readonly CompetitionVersionDifference[]} contentDifferences
 * @property {readonly CompetitionVersionDifference[]} metadataDifferences
 */

/**
 * @param {string} path
 * @param {string} changeType
 * @param {*} before
 * @param {*} after
 * @returns {Readonly<CompetitionVersionDifference>}
 */
export function createVersionDifference(path, changeType, before, after) {
  return deepFreeze({
    path: String(path),
    changeType: String(changeType),
    before: before === undefined ? null : clonePlain(before),
    after: after === undefined ? null : clonePlain(after),
  });
}

/**
 * @param {CompetitionVersionDifference[]} diffs
 * @returns {CompetitionVersionDifference[]}
 */
export function sortVersionDifferences(diffs) {
  return [...diffs].sort((a, b) => {
    const byPath = compareFieldPath(a.path, b.path);
    if (byPath !== 0) return byPath;
    return String(a.changeType).localeCompare(String(b.changeType), "en");
  });
}

/**
 * Deep compare two plain values into typed differences (arrays compared by index).
 * @param {*} left
 * @param {*} right
 * @param {string} basePath
 * @param {CompetitionVersionDifference[]} out
 */
function collectDiffs(left, right, basePath, out) {
  if (canonicalizeJson(left) === canonicalizeJson(right)) {
    return;
  }

  const leftIsObj = left !== null && typeof left === "object";
  const rightIsObj = right !== null && typeof right === "object";

  if (!leftIsObj || !rightIsObj || Array.isArray(left) !== Array.isArray(right)) {
    if (left === undefined || left === null) {
      if (right !== undefined && right !== null) {
        out.push(
          createVersionDifference(
            basePath,
            COMPETITION_VERSION_CHANGE_TYPE.ADDED,
            null,
            right
          )
        );
      }
      return;
    }
    if (right === undefined || right === null) {
      out.push(
        createVersionDifference(
          basePath,
          COMPETITION_VERSION_CHANGE_TYPE.REMOVED,
          left,
          null
        )
      );
      return;
    }
    out.push(
      createVersionDifference(
        basePath,
        COMPETITION_VERSION_CHANGE_TYPE.CHANGED,
        left,
        right
      )
    );
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i += 1) {
      const path = `${basePath}[${i}]`;
      if (i >= left.length) {
        out.push(
          createVersionDifference(
            path,
            COMPETITION_VERSION_CHANGE_TYPE.ADDED,
            null,
            right[i]
          )
        );
      } else if (i >= right.length) {
        out.push(
          createVersionDifference(
            path,
            COMPETITION_VERSION_CHANGE_TYPE.REMOVED,
            left[i],
            null
          )
        );
      } else {
        collectDiffs(left[i], right[i], path, out);
      }
    }
    return;
  }

  const leftObj = /** @type {Record<string, unknown>} */ (left);
  const rightObj = /** @type {Record<string, unknown>} */ (right);
  const keys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
  const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b, "en"));
  for (const key of sortedKeys) {
    const path = basePath ? `${basePath}.${key}` : key;
    const hasLeft = Object.prototype.hasOwnProperty.call(leftObj, key);
    const hasRight = Object.prototype.hasOwnProperty.call(rightObj, key);
    if (!hasLeft) {
      out.push(
        createVersionDifference(
          path,
          COMPETITION_VERSION_CHANGE_TYPE.ADDED,
          null,
          rightObj[key]
        )
      );
    } else if (!hasRight) {
      out.push(
        createVersionDifference(
          path,
          COMPETITION_VERSION_CHANGE_TYPE.REMOVED,
          leftObj[key],
          null
        )
      );
    } else {
      collectDiffs(leftObj[key], rightObj[key], path, out);
    }
  }
}

/**
 * Compare two CompetitionVersion aggregates.
 * Requires same tenant; same competition by default (fail-closed).
 *
 * @param {{
 *   tenantId: string,
 *   left: object,
 *   right: object,
 *   allowCrossCompetition?: boolean,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionVersionValidationResult}
 */
export function compareCompetitionVersions(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  /** @type {import("../contracts/validation.js").CompetitionVersionFieldError[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }

  if (!isCompetitionVersion(cmd.left)) {
    errors.push(
      createFieldError(
        "left",
        COMPETITION_VERSION_ERROR_CODE.MALFORMED_SNAPSHOT,
        "left must be a valid CompetitionVersion",
        {}
      )
    );
  }

  if (!isCompetitionVersion(cmd.right)) {
    errors.push(
      createFieldError(
        "right",
        COMPETITION_VERSION_ERROR_CODE.MALFORMED_SNAPSHOT,
        "right must be a valid CompetitionVersion",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const left = /** @type {import("../contracts/snapshot.js").CompetitionVersion} */ (
    cmd.left
  );
  const right = /** @type {import("../contracts/snapshot.js").CompetitionVersion} */ (
    cmd.right
  );

  if (left.tenantId !== tenantId || right.tenantId !== tenantId) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_VERSION_ERROR_CODE.CROSS_TENANT_DENIED,
        "both versions must belong to the explicit tenantId",
        {
          tenantId,
          leftTenantId: left.tenantId,
          rightTenantId: right.tenantId,
        }
      ),
    ]);
  }

  if (
    left.competitionId !== right.competitionId &&
    cmd.allowCrossCompetition !== true
  ) {
    return validationFail([
      createFieldError(
        "competitionId",
        COMPETITION_VERSION_ERROR_CODE.CROSS_COMPETITION_COMPARE,
        "cross-competition comparison is rejected unless allowCrossCompetition=true",
        {
          leftCompetitionId: left.competitionId,
          rightCompetitionId: right.competitionId,
        }
      ),
    ]);
  }

  /** @type {CompetitionVersionDifference[]} */
  const contentDiffs = [];
  collectDiffs(left.content, right.content, "content", contentDiffs);

  // Metadata semantic subset only (exclude volatile createdAt / actor / reason / key).
  const leftMeta = {
    sourceDefinitionRevision: left.metadata.sourceDefinitionRevision,
    fingerprintAlgorithm: left.metadata.fingerprintAlgorithm,
  };
  const rightMeta = {
    sourceDefinitionRevision: right.metadata.sourceDefinitionRevision,
    fingerprintAlgorithm: right.metadata.fingerprintAlgorithm,
  };
  /** @type {CompetitionVersionDifference[]} */
  const metaDiffs = [];
  collectDiffs(leftMeta, rightMeta, "metadata", metaDiffs);

  const contentDifferences = Object.freeze(sortVersionDifferences(contentDiffs));
  const metadataDifferences = Object.freeze(sortVersionDifferences(metaDiffs));
  const differences = Object.freeze(
    sortVersionDifferences([...contentDifferences, ...metadataDifferences])
  );

  /** @type {CompetitionVersionComparisonResult} */
  const result = {
    tenantId,
    competitionId: left.competitionId,
    leftVersionId: left.versionId,
    rightVersionId: right.versionId,
    equal: differences.length === 0,
    differences,
    contentDifferences,
    metadataDifferences,
  };

  return validationOk(deepFreeze(result), {
    summary: result.equal
      ? "Competition versions are semantically equal."
      : `Competition versions differ (${differences.length} field differences).`,
    reasons: Object.freeze([
      `left=${left.versionId}`,
      `right=${right.versionId}`,
      `equal=${result.equal}`,
      `differenceCount=${differences.length}`,
    ]),
  });
}
