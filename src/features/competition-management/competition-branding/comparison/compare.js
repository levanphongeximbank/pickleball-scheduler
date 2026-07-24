/**
 * CM-05 branding comparison — typed field differences, deterministic ordering.
 */

import { COMPETITION_BRANDING_CHANGE_TYPE } from "../constants/comparison.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
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
  isCompetitionBranding,
  semanticBrandingPayload,
} from "../contracts/branding.js";

/**
 * @typedef {Object} CompetitionBrandingDifference
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
 * @returns {Readonly<CompetitionBrandingDifference>}
 */
export function createBrandingDifference(path, changeType, before, after) {
  return deepFreeze({
    path: String(path),
    changeType: String(changeType),
    before: before === undefined ? null : clonePlain(before),
    after: after === undefined ? null : clonePlain(after),
  });
}

/**
 * @param {CompetitionBrandingDifference[]} diffs
 * @returns {CompetitionBrandingDifference[]}
 */
export function sortBrandingDifferences(diffs) {
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
 * @param {CompetitionBrandingDifference[]} out
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
          createBrandingDifference(
            basePath,
            COMPETITION_BRANDING_CHANGE_TYPE.ADDED,
            null,
            right
          )
        );
      }
      return;
    }
    if (right === undefined || right === null) {
      out.push(
        createBrandingDifference(
          basePath,
          COMPETITION_BRANDING_CHANGE_TYPE.REMOVED,
          left,
          null
        )
      );
      return;
    }
    out.push(
      createBrandingDifference(
        basePath,
        COMPETITION_BRANDING_CHANGE_TYPE.CHANGED,
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
          createBrandingDifference(
            path,
            COMPETITION_BRANDING_CHANGE_TYPE.ADDED,
            null,
            right[i]
          )
        );
      } else if (i >= right.length) {
        out.push(
          createBrandingDifference(
            path,
            COMPETITION_BRANDING_CHANGE_TYPE.REMOVED,
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
        createBrandingDifference(
          path,
          COMPETITION_BRANDING_CHANGE_TYPE.ADDED,
          null,
          rightObj[key]
        )
      );
    } else if (!hasRight) {
      out.push(
        createBrandingDifference(
          path,
          COMPETITION_BRANDING_CHANGE_TYPE.REMOVED,
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
 * Compare two CompetitionBranding aggregates.
 *
 * @param {{
 *   tenantId: string,
 *   left: object,
 *   right: object,
 *   allowCrossCompetition?: boolean,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionBrandingValidationResult}
 */
export function compareCompetitionBrandings(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  /** @type {object[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }

  if (!isCompetitionBranding(cmd.left)) {
    errors.push(
      createFieldError(
        "left",
        COMPETITION_BRANDING_ERROR_CODE.MALFORMED_BRANDING,
        "left must be a valid CompetitionBranding",
        {}
      )
    );
  }

  if (!isCompetitionBranding(cmd.right)) {
    errors.push(
      createFieldError(
        "right",
        COMPETITION_BRANDING_ERROR_CODE.MALFORMED_BRANDING,
        "right must be a valid CompetitionBranding",
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
        COMPETITION_BRANDING_ERROR_CODE.CROSS_TENANT_DENIED,
        "both brandings must belong to the explicit tenantId",
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
        COMPETITION_BRANDING_ERROR_CODE.CROSS_COMPETITION_COMPARE,
        "cross-competition comparison is rejected unless allowCrossCompetition=true",
        {
          leftCompetitionId: left.competitionId,
          rightCompetitionId: right.competitionId,
        }
      ),
    ]);
  }

  /** @type {CompetitionBrandingDifference[]} */
  const semanticDiffs = [];
  collectDiffs(
    semanticBrandingPayload(left),
    semanticBrandingPayload(right),
    "branding",
    semanticDiffs
  );

  /** @type {CompetitionBrandingDifference[]} */
  const revisionDiffs = [];
  if (left.revision !== right.revision) {
    revisionDiffs.push(
      createBrandingDifference(
        "revision",
        COMPETITION_BRANDING_CHANGE_TYPE.CHANGED,
        left.revision,
        right.revision
      )
    );
  }

  const differences = Object.freeze(
    sortBrandingDifferences([...semanticDiffs, ...revisionDiffs])
  );

  const result = deepFreeze({
    tenantId,
    competitionId: left.competitionId,
    leftBrandingId: left.brandingId,
    rightBrandingId: right.brandingId,
    leftRevision: left.revision,
    rightRevision: right.revision,
    equal: differences.length === 0,
    differences,
  });

  return validationOk(result, {
    summary: result.equal
      ? "Competition brandings are semantically equal."
      : `Competition brandings differ (${differences.length} field differences).`,
    reasons: Object.freeze([
      `left=${left.brandingId}@${left.revision}`,
      `right=${right.brandingId}@${right.revision}`,
      `equal=${result.equal}`,
      `differenceCount=${differences.length}`,
    ]),
  });
}
