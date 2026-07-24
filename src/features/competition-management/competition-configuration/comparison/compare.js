/**
 * CM-04 configuration comparison — typed field differences, deterministic ordering.
 */

import { COMPETITION_CONFIGURATION_CHANGE_TYPE } from "../constants/comparison.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
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
import {
  isCompetitionConfiguration,
  semanticConfigurationPayload,
} from "../contracts/configuration.js";

/**
 * @typedef {Object} CompetitionConfigurationDifference
 * @property {string} path
 * @property {string} changeType
 * @property {*} before
 * @property {*} after
 */

/**
 * @param {string} path
 * @param {string} changeType
 * @param {*} before
 * @param {*} after
 * @returns {Readonly<CompetitionConfigurationDifference>}
 */
export function createConfigurationDifference(path, changeType, before, after) {
  return deepFreeze({
    path: String(path),
    changeType: String(changeType),
    before: before === undefined ? null : clonePlain(before),
    after: after === undefined ? null : clonePlain(after),
  });
}

/**
 * @param {CompetitionConfigurationDifference[]} diffs
 * @returns {CompetitionConfigurationDifference[]}
 */
export function sortConfigurationDifferences(diffs) {
  return [...diffs].sort((a, b) => {
    const byPath = compareFieldPath(a.path, b.path);
    if (byPath !== 0) return byPath;
    return String(a.changeType).localeCompare(String(b.changeType), "en");
  });
}

/**
 * @param {*} left
 * @param {*} right
 * @param {string} basePath
 * @param {CompetitionConfigurationDifference[]} out
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
          createConfigurationDifference(
            basePath,
            COMPETITION_CONFIGURATION_CHANGE_TYPE.ADDED,
            null,
            right
          )
        );
      }
      return;
    }
    if (right === undefined || right === null) {
      out.push(
        createConfigurationDifference(
          basePath,
          COMPETITION_CONFIGURATION_CHANGE_TYPE.REMOVED,
          left,
          null
        )
      );
      return;
    }
    out.push(
      createConfigurationDifference(
        basePath,
        COMPETITION_CONFIGURATION_CHANGE_TYPE.CHANGED,
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
          createConfigurationDifference(
            path,
            COMPETITION_CONFIGURATION_CHANGE_TYPE.ADDED,
            null,
            right[i]
          )
        );
      } else if (i >= right.length) {
        out.push(
          createConfigurationDifference(
            path,
            COMPETITION_CONFIGURATION_CHANGE_TYPE.REMOVED,
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
        createConfigurationDifference(
          path,
          COMPETITION_CONFIGURATION_CHANGE_TYPE.ADDED,
          null,
          rightObj[key]
        )
      );
    } else if (!hasRight) {
      out.push(
        createConfigurationDifference(
          path,
          COMPETITION_CONFIGURATION_CHANGE_TYPE.REMOVED,
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
 * Compare two CompetitionConfiguration aggregates.
 *
 * @param {{
 *   tenantId: string,
 *   left: object,
 *   right: object,
 *   allowCrossCompetition?: boolean,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionConfigurationValidationResult}
 */
export function compareCompetitionConfigurations(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  /** @type {object[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }

  if (!isCompetitionConfiguration(cmd.left)) {
    errors.push(
      createFieldError(
        "left",
        COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_CONFIGURATION,
        "left must be a valid CompetitionConfiguration",
        {}
      )
    );
  }

  if (!isCompetitionConfiguration(cmd.right)) {
    errors.push(
      createFieldError(
        "right",
        COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_CONFIGURATION,
        "right must be a valid CompetitionConfiguration",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const left = /** @type {any} */ (cmd.left);
  const right = /** @type {any} */ (cmd.right);

  if (left.tenantId !== tenantId || right.tenantId !== tenantId) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_TENANT_DENIED,
        "both configurations must belong to the explicit tenantId",
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
        COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_COMPETITION_COMPARE,
        "cross-competition comparison is rejected unless allowCrossCompetition=true",
        {
          leftCompetitionId: left.competitionId,
          rightCompetitionId: right.competitionId,
        }
      ),
    ]);
  }

  /** @type {CompetitionConfigurationDifference[]} */
  const semanticDiffs = [];
  collectDiffs(
    semanticConfigurationPayload(left),
    semanticConfigurationPayload(right),
    "configuration",
    semanticDiffs
  );

  /** @type {CompetitionConfigurationDifference[]} */
  const revisionDiffs = [];
  if (left.revision !== right.revision) {
    revisionDiffs.push(
      createConfigurationDifference(
        "revision",
        COMPETITION_CONFIGURATION_CHANGE_TYPE.CHANGED,
        left.revision,
        right.revision
      )
    );
  }

  const differences = Object.freeze(
    sortConfigurationDifferences([...semanticDiffs, ...revisionDiffs])
  );

  const result = deepFreeze({
    tenantId,
    competitionId: left.competitionId,
    leftConfigurationId: left.configurationId,
    rightConfigurationId: right.configurationId,
    leftRevision: left.revision,
    rightRevision: right.revision,
    equal: differences.length === 0,
    differences,
  });

  return validationOk(result, {
    summary: result.equal
      ? "Competition configurations are semantically equal."
      : `Competition configurations differ (${differences.length} field differences).`,
    reasons: Object.freeze([
      `left=${left.configurationId}@${left.revision}`,
      `right=${right.configurationId}@${right.revision}`,
      `equal=${result.equal}`,
      `differenceCount=${differences.length}`,
    ]),
  });
}
