/**
 * CORE-09 — DrawSnapshot fail-closed validation for Match Generation.
 * Does not mutate the snapshot. Format-neutral catalog rules:
 * - Non-empty groupId on a placement requires a non-empty group catalog containing that id.
 * - Non-empty bracketId on a placement requires a non-empty bracket catalog containing that id.
 * - Empty catalogs are allowed only when no placement references that catalog type.
 */

import { DRAW_COMPLETION_STATUS } from "../contracts/drawSnapshot.js";
import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "./asciiCompare.js";

/**
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot|object|null|undefined} snapshot
 * @param {object} [request]
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateDrawSnapshotForGeneration(snapshot, request = {}) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  if (!snapshot || typeof snapshot !== "object") {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE,
        path: "drawSnapshot",
        message: "DrawSnapshot is required",
      })
    );
    return sortMatchGenerationIssues(issues);
  }

  if (!String(snapshot.drawFingerprint || "").trim()) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISSING,
        path: "drawFingerprint",
        message: "Draw fingerprint is absent",
      })
    );
  }

  if (snapshot.completionStatus !== DRAW_COMPLETION_STATUS.COMPLETE) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE,
        path: "completionStatus",
        message: "Draw is incomplete",
        details: { completionStatus: snapshot.completionStatus ?? null },
      })
    );
  }

  if (
    request?.drawVersion &&
    snapshot.drawVersion &&
    String(request.drawVersion).trim() !== String(snapshot.drawVersion).trim()
  ) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_VERSION_MISMATCH,
        path: "drawVersion",
        message: "Draw version does not match the requested reference",
        details: {
          requested: request.drawVersion,
          actual: snapshot.drawVersion,
        },
      })
    );
  }

  if (
    request?.drawFingerprint &&
    snapshot.drawFingerprint &&
    String(request.drawFingerprint).trim() !==
      String(snapshot.drawFingerprint).trim()
  ) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISMATCH,
        path: "drawFingerprint",
        message: "Draw fingerprint does not match the requested reference",
      })
    );
  }

  const placements = Array.isArray(snapshot.participantPlacements)
    ? snapshot.participantPlacements
    : [];

  const groupCatalog = Array.isArray(snapshot.groupPlacements)
    ? snapshot.groupPlacements
    : [];
  const bracketCatalog = Array.isArray(snapshot.bracketPlacements)
    ? snapshot.bracketPlacements
    : [];

  /** @type {Set<string>} */
  const groupIds = new Set(
    groupCatalog
      .map((g) => String(g?.groupId || g?.id || "").trim())
      .filter(Boolean)
  );
  /** @type {Set<string>} */
  const bracketIds = new Set(
    bracketCatalog
      .map((b) => String(b?.bracketId || b?.id || "").trim())
      .filter(Boolean)
  );

  /** @type {Map<string, number>} */
  const participantCounts = new Map();
  /** @type {Map<string, number>} */
  const placementRefCounts = new Map();

  for (let i = 0; i < placements.length; i += 1) {
    const p = placements[i];
    const path = `participantPlacements[${i}]`;
    const placementRef = String(p?.placementRef || "").trim();
    const participantId = String(p?.participantId || "").trim();
    const isBye = p?.isBye === true;
    const groupId = String(p?.groupId || "").trim();
    const bracketId = String(p?.bracketId || "").trim();

    if (!placementRef) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.placementRef`,
          message: "Placement reference is missing",
        })
      );
    } else {
      placementRefCounts.set(
        placementRef,
        (placementRefCounts.get(placementRef) || 0) + 1
      );
    }

    if (!isBye && !participantId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.participantId`,
          message: "Participant placement is missing",
        })
      );
    }

    if (participantId) {
      participantCounts.set(
        participantId,
        (participantCounts.get(participantId) || 0) + 1
      );
    }

    if (groupId) {
      if (groupIds.size === 0) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_CATALOG_EMPTY,
            path: `${path}.groupId`,
            message:
              "Group reference present but group catalog is empty",
            details: { groupId },
          })
        );
      } else if (!groupIds.has(groupId)) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
            path: `${path}.groupId`,
            message: "Group reference is invalid",
            details: { groupId },
          })
        );
      }
    }

    if (bracketId) {
      if (bracketIds.size === 0) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_CATALOG_EMPTY,
            path: `${path}.bracketId`,
            message:
              "Bracket reference present but bracket catalog is empty",
            details: { bracketId },
          })
        );
      } else if (!bracketIds.has(bracketId)) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
            path: `${path}.bracketId`,
            message: "Bracket reference is invalid",
            details: { bracketId },
          })
        );
      }
    }
  }

  for (const [participantId, count] of participantCounts.entries()) {
    if (count > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: "participantPlacements",
          message: "Participant placement is duplicated",
          details: { participantId, count },
        })
      );
    }
  }

  for (const [placementRef, count] of placementRefCounts.entries()) {
    if (count > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: "participantPlacements",
          message: "Placement reference is duplicated",
          details: { placementRef, count },
        })
      );
    }
  }

  return sortMatchGenerationIssues(issues);
}

/**
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} original
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} candidate
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateDrawSnapshotNotMutated(original, candidate) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];
  if (
    String(original?.drawFingerprint || "") !==
    String(candidate?.drawFingerprint || "")
  ) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_MUTATION_DETECTED,
        path: "drawFingerprint",
        message: "Draw fingerprint changed after binding",
      })
    );
  }

  const origRefs = (original?.participantPlacements || [])
    .map((p) => `${p.placementRef}|${p.participantId}|${p.isBye}`)
    .join(";");
  const candRefs = (candidate?.participantPlacements || [])
    .map((p) => `${p.placementRef}|${p.participantId}|${p.isBye}`)
    .join(";");

  if (origRefs !== candRefs) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_MUTATION_DETECTED,
        path: "participantPlacements",
        message: "Draw placements were mutated",
      })
    );
  }

  return sortMatchGenerationIssues(issues);
}
