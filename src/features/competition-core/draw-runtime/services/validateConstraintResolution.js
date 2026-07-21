/**
 * CORE-08 Phase 1C — revalidate constraint resolver output against
 * canonical Phase 3H placement invariants. Format-neutral; no rule engine.
 */

import { buildGroupIdentityKey } from "../contracts/drawIdentity.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";
import { PLACEMENT_TYPE } from "../enums/placementTypes.js";
import { LAYOUT_TYPE } from "../enums/layoutTypes.js";

/**
 * @param {import('../contracts/drawPlacement.js').DrawPlacement} placement
 * @returns {number|null}
 */
function groupNumberOf(placement) {
  if (
    placement.metadata &&
    typeof placement.metadata === "object" &&
    placement.metadata.groupNumber != null &&
    Number.isFinite(Number(placement.metadata.groupNumber))
  ) {
    return Number(placement.metadata.groupNumber);
  }
  if (!placement.groupIdentityKey) return null;
  const m = String(placement.groupIdentityKey).match(/::GROUP::(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @returns {Map<string, import('../contracts/drawCandidate.js').DrawCandidate>}
 */
function candidateIndex(candidates) {
  /** @type {Map<string, import('../contracts/drawCandidate.js').DrawCandidate>} */
  const byKey = new Map();
  for (const c of candidates) {
    byKey.set(String(c.candidateIdentityKey), c);
  }
  return byKey;
}

/**
 * @param {import('../contracts/drawPlacement.js').DrawPlacement[]} proposal
 * @param {import('../contracts/drawPlacement.js').DrawPlacement[]} adjusted
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {{
 *   drawIdentityKey: string,
 *   groupCount: number|null,
 *   groupCapacity: number|null,
 *   bracketSize: number|null,
 *   layoutType: string,
 *   byes?: import('../contracts/drawGroup.js').DrawBye[],
 *   proposalByes?: import('../contracts/drawGroup.js').DrawBye[],
 * }} bounds
 */
export function validateConstraintResolutionOutput(
  proposal,
  adjusted,
  candidates,
  bounds
) {
  if (!Array.isArray(adjusted)) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
      "Constraint resolver placements must be an array",
      {}
    );
  }

  const byCandidate = candidateIndex(candidates);
  const proposalKeys = new Set(
    proposal.map((p) => String(p.candidateIdentityKey))
  );
  const adjustedKeys = new Set();

  /** @type {Map<string, number>} */
  const groupSizes = new Map();
  /** @type {Map<string, string>} */
  const groupPos = new Map();
  /** @type {Map<number, string>} */
  const slots = new Map();

  for (const placement of adjusted) {
    if (!placement || typeof placement !== "object") {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
        "Constraint resolver placement must be an object",
        {}
      );
    }

    const candKey = String(placement.candidateIdentityKey || "");
    if (!candKey) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
        "Constraint resolver placement missing candidateIdentityKey",
        {}
      );
    }

    if (!byCandidate.has(candKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver introduced unknown candidate",
        { candidateIdentityKey: candKey }
      );
    }

    if (adjustedKeys.has(candKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver duplicated candidate",
        { candidateIdentityKey: candKey }
      );
    }
    adjustedKeys.add(candKey);

    if (!proposalKeys.has(candKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver introduced candidate not in proposal",
        { candidateIdentityKey: candKey }
      );
    }

    if (String(placement.drawIdentityKey) !== String(bounds.drawIdentityKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver altered draw identity",
        {
          expected: bounds.drawIdentityKey,
          actual: placement.drawIdentityKey,
        }
      );
    }

    const candidate = byCandidate.get(candKey);
    const expectedSeed =
      candidate.seedNumber != null && Number.isFinite(Number(candidate.seedNumber))
        ? Number(candidate.seedNumber)
        : null;
    const actualSeed =
      placement.seedNumber != null && Number.isFinite(Number(placement.seedNumber))
        ? Number(placement.seedNumber)
        : null;
    if (expectedSeed !== actualSeed) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver reassigned seed identity",
        {
          candidateIdentityKey: candKey,
          expectedSeed,
          actualSeed,
        }
      );
    }

    // Manual / protected respect
    if (candidate.manualPlacement && candidate.manualPlacement.groupNumber != null) {
      const gn = groupNumberOf(placement);
      const expectedGn = Number(candidate.manualPlacement.groupNumber);
      if (gn !== expectedGn) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          candidate.protectedPlacement
            ? "Constraint resolver violated protected placement"
            : "Constraint resolver violated manual placement",
          {
            candidateIdentityKey: candKey,
            expectedGroupNumber: expectedGn,
            actualGroupNumber: gn,
            protected: candidate.protectedPlacement === true,
          }
        );
      }
      if (
        candidate.manualPlacement.positionNumber != null &&
        placement.positionNumber != null &&
        Number(candidate.manualPlacement.positionNumber) !==
          Number(placement.positionNumber)
      ) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          candidate.protectedPlacement
            ? "Constraint resolver violated protected position"
            : "Constraint resolver violated manual position",
          {
            candidateIdentityKey: candKey,
            expectedPosition: candidate.manualPlacement.positionNumber,
            actualPosition: placement.positionNumber,
          }
        );
      }
    }

    if (
      candidate.manualPlacement &&
      candidate.manualPlacement.slotNumber != null
    ) {
      const expectedSlot = Number(candidate.manualPlacement.slotNumber);
      const actualSlot =
        placement.slotNumber != null ? Number(placement.slotNumber) : null;
      if (actualSlot !== expectedSlot) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          candidate.protectedPlacement
            ? "Constraint resolver violated protected bracket slot"
            : "Constraint resolver violated manual bracket slot",
          {
            candidateIdentityKey: candKey,
            expectedSlot,
            actualSlot,
          }
        );
      }
    }

    if (bounds.layoutType === LAYOUT_TYPE.GROUPS || bounds.groupCount != null) {
      const gn = groupNumberOf(placement);
      if (gn == null || !Number.isInteger(gn)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
          "Constraint resolver placement missing valid groupNumber",
          { candidateIdentityKey: candKey }
        );
      }
      if (bounds.groupCount != null && (gn < 1 || gn > bounds.groupCount)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver used invalid group reference",
          { groupNumber: gn, groupCount: bounds.groupCount }
        );
      }

      const expectedGroupKey = buildGroupIdentityKey({
        drawIdentityKey: bounds.drawIdentityKey,
        groupNumber: gn,
      });
      if (
        placement.groupIdentityKey &&
        String(placement.groupIdentityKey) !== expectedGroupKey
      ) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver groupIdentityKey mismatch",
          {
            expected: expectedGroupKey,
            actual: placement.groupIdentityKey,
          }
        );
      }

      const size = (groupSizes.get(String(gn)) || 0) + 1;
      groupSizes.set(String(gn), size);
      if (bounds.groupCapacity != null && size > bounds.groupCapacity) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver exceeded group capacity",
          { groupNumber: gn, groupCapacity: bounds.groupCapacity, size }
        );
      }

      if (
        placement.positionNumber != null &&
        Number.isFinite(Number(placement.positionNumber))
      ) {
        const pos = Number(placement.positionNumber);
        if (!Number.isInteger(pos) || pos < 1) {
          throw new DrawRuntimeError(
            DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
            "Constraint resolver positionNumber invalid",
            { positionNumber: pos, candidateIdentityKey: candKey }
          );
        }
        const posKey = `${gn}::${pos}`;
        if (groupPos.has(posKey)) {
          throw new DrawRuntimeError(
            DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
            "Constraint resolver duplicated group position",
            {
              groupNumber: gn,
              positionNumber: pos,
              first: groupPos.get(posKey),
              second: candKey,
            }
          );
        }
        groupPos.set(posKey, candKey);
      }
    }

    if (
      bounds.layoutType === LAYOUT_TYPE.BRACKET ||
      placement.placementType === PLACEMENT_TYPE.BRACKET ||
      placement.slotNumber != null
    ) {
      const slot =
        placement.slotNumber != null ? Number(placement.slotNumber) : null;
      if (slot == null || !Number.isInteger(slot) || slot < 1) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
          "Constraint resolver bracket placement missing valid slotNumber",
          { candidateIdentityKey: candKey }
        );
      }
      if (bounds.bracketSize != null && slot > bounds.bracketSize) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver used invalid slot reference",
          { slotNumber: slot, bracketSize: bounds.bracketSize }
        );
      }
      if (slots.has(slot)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver duplicated bracket slot",
          { slotNumber: slot, first: slots.get(slot), second: candKey }
        );
      }
      slots.set(slot, candKey);
    }
  }

  for (const key of proposalKeys) {
    if (!adjustedKeys.has(key)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver silently removed assigned candidate",
        { candidateIdentityKey: key }
      );
    }
  }

  if (proposalKeys.size !== adjustedKeys.size) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
      "Constraint resolver changed assigned candidate cardinality",
      {
        proposalCount: proposalKeys.size,
        adjustedCount: adjustedKeys.size,
      }
    );
  }

  // Bye records: when provided on adjusted path, cardinality/slots must remain valid
  if (Array.isArray(bounds.byes) && Array.isArray(bounds.proposalByes)) {
    if (bounds.byes.length !== bounds.proposalByes.length) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
        "Constraint resolver altered bye cardinality",
        {
          expected: bounds.proposalByes.length,
          actual: bounds.byes.length,
        }
      );
    }
    const byeSlots = new Set();
    for (const bye of bounds.byes) {
      if (!bye || typeof bye !== "object") {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
          "Constraint resolver bye must be an object",
          {}
        );
      }
      const slot =
        bye.slotNumber != null ? Number(bye.slotNumber) : NaN;
      if (!Number.isInteger(slot) || slot < 1) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
          "Constraint resolver bye missing valid slotNumber",
          {}
        );
      }
      if (bounds.bracketSize != null && slot > bounds.bracketSize) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver bye slot out of range",
          { slotNumber: slot, bracketSize: bounds.bracketSize }
        );
      }
      if (byeSlots.has(slot) || slots.has(slot)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver bye conflicts with placement or duplicate bye",
          { slotNumber: slot }
        );
      }
      byeSlots.add(slot);
      if (String(bye.drawIdentityKey) !== String(bounds.drawIdentityKey)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver bye draw identity mismatch",
          { expected: bounds.drawIdentityKey, actual: bye.drawIdentityKey }
        );
      }
    }
  }

  return { ok: true };
}
