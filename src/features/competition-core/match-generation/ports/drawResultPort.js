/**
 * CORE-09 — read-only DrawResultPort.
 * Resolves a frozen DrawSnapshot. Never reruns Draw or mutates placements.
 */

import {
  createDrawSnapshot,
  DRAW_COMPLETION_STATUS,
} from "../contracts/drawSnapshot.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_ISSUE_SEVERITY } from "../enums/issueSeverity.js";
import { validateDrawSnapshotForGeneration } from "../services/validateDrawSnapshot.js";

export const DRAW_RESULT_PORT_METHODS = Object.freeze([
  "resolveDrawSnapshot",
]);

/**
 * @typedef {Object} DrawResolveRequest
 * @property {string} competitionId
 * @property {string} divisionId
 * @property {string|null} [categoryId]
 * @property {string} drawId
 * @property {string} drawVersion
 * @property {string} drawFingerprint
 */

/**
 * @typedef {Object} DrawResolveResult
 * @property {boolean} ok
 * @property {import('../contracts/drawSnapshot.js').DrawSnapshot|null} drawSnapshot
 * @property {ReadonlyArray<import('../contracts/matchGenerationIssue.js').MatchGenerationIssue>} issues
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesDrawResultPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveDrawSnapshot?: unknown }} */ (port)
        .resolveDrawSnapshot === "function"
  );
}

/**
 * Fail-closed port: always incomplete / missing fingerprint.
 * @returns {{ resolveDrawSnapshot: (request: DrawResolveRequest) => Promise<DrawResolveResult> }}
 */
export function createFailClosedDrawResultPort() {
  return {
    async resolveDrawSnapshot(request) {
      const issues = [
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE,
          severity: MATCH_GENERATION_ISSUE_SEVERITY.ERROR,
          path: "drawSnapshot",
          message: "DrawResultPort denied: fail-closed double",
          details: {
            drawId: request?.drawId ?? null,
          },
        }),
      ];
      return Object.freeze({
        ok: false,
        drawSnapshot: null,
        issues: Object.freeze(issues),
      });
    },
  };
}

/**
 * In-memory read-only double for contract tests.
 *
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot|object} snapshot
 * @returns {{ resolveDrawSnapshot: (request: DrawResolveRequest) => Promise<DrawResolveResult> }}
 */
export function createFixedDrawResultPort(snapshot) {
  const frozen = createDrawSnapshot(snapshot);

  return {
    async resolveDrawSnapshot(request) {
      /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
      const issues = [];

      if (
        request?.drawId &&
        frozen.drawId &&
        String(request.drawId).trim() !== frozen.drawId
      ) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
            path: "drawReference.drawId",
            message: "Requested drawId does not match bound snapshot",
            details: {
              requested: request.drawId,
              actual: frozen.drawId,
            },
          })
        );
      }

      if (
        request?.drawVersion &&
        frozen.drawVersion &&
        String(request.drawVersion).trim() !== frozen.drawVersion
      ) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_VERSION_MISMATCH,
            path: "drawReference.drawVersion",
            message: "Draw version does not match requested reference",
            details: {
              requested: request.drawVersion,
              actual: frozen.drawVersion,
            },
          })
        );
      }

      if (
        request?.drawFingerprint &&
        frozen.drawFingerprint &&
        String(request.drawFingerprint).trim() !== frozen.drawFingerprint
      ) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISMATCH,
            path: "drawReference.drawFingerprint",
            message: "Draw fingerprint does not match requested reference",
            details: {
              requested: request.drawFingerprint,
              actual: frozen.drawFingerprint,
            },
          })
        );
      }

      issues.push(...validateDrawSnapshotForGeneration(frozen, request));

      if (issues.length > 0) {
        return Object.freeze({
          ok: false,
          drawSnapshot: null,
          issues: Object.freeze(issues),
        });
      }

      if (frozen.completionStatus !== DRAW_COMPLETION_STATUS.COMPLETE) {
        return Object.freeze({
          ok: false,
          drawSnapshot: null,
          issues: Object.freeze([
            createMatchGenerationIssue({
              code: MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE,
              path: "completionStatus",
              message: "Draw is incomplete",
              details: { completionStatus: frozen.completionStatus },
            }),
          ]),
        });
      }

      return Object.freeze({
        ok: true,
        drawSnapshot: frozen,
        issues: Object.freeze([]),
      });
    },
  };
}
