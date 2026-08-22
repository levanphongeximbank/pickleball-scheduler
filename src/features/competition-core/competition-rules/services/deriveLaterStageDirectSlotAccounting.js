import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  KNOCKOUT_ENTRY_ROUND,
  KNOCKOUT_ENTRY_ROUND_ORDER,
  isDirectEntryTargetStageCompatible,
  knockoutEntryRoundRank,
} from "../constants/enums.js";

const FINAL_REQUIRED_SLOTS = 2;

function freezeStageCounts(stages, counts) {
  return Object.freeze(
    Object.fromEntries(stages.map((stage) => [stage, Number(counts[stage] || 0)]))
  );
}

function fail(message, details = {}) {
  return Object.freeze({
    ok: false,
    code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
    message,
    details: Object.freeze(details),
    accounting: null,
  });
}

function nominalStageCapacity(stage) {
  const rank = knockoutEntryRoundRank(stage);
  if (rank < 0) return null;
  return 2 ** (KNOCKOUT_ENTRY_ROUND_ORDER.length - rank);
}

/**
 * Derive canonical later-stage DIRECT admission accounting.
 *
 * Policy only: no seeds, bracket positions, match IDs, sides, or dependencies.
 *
 * @param {{
 *   bracketWideEntryRound: string,
 *   entrants?: Array<{ entryId?: string, effectiveTargetStage?: string, targetStage?: string }>,
 *   unresolvedDirectSlotCount?: number,
 *   unresolvedTargetStage?: string|null,
 *   configuredDirectSlotCount?: number
 * }} input
 */
export function deriveLaterStageDirectSlotAccounting(input = {}) {
  const bracketWideEntryRound = input.bracketWideEntryRound;
  const bracketRank = knockoutEntryRoundRank(bracketWideEntryRound);
  if (bracketRank < 0) {
    return fail("Valid bracketWideEntryRound required for DIRECT slot accounting", {
      bracketWideEntryRound: bracketWideEntryRound || null,
    });
  }

  const stages = KNOCKOUT_ENTRY_ROUND_ORDER.slice(bracketRank);
  const entrants = Array.isArray(input.entrants) ? input.entrants : [];
  const unresolvedDirectSlotCount = Number(
    input.unresolvedDirectSlotCount ?? 0
  );
  const configuredDirectSlotCount = Number(
    input.configuredDirectSlotCount ??
      entrants.length + unresolvedDirectSlotCount
  );
  if (
    !Number.isInteger(unresolvedDirectSlotCount) ||
    unresolvedDirectSlotCount < 0 ||
    !Number.isInteger(configuredDirectSlotCount) ||
    configuredDirectSlotCount < 0 ||
    configuredDirectSlotCount !==
      entrants.length + unresolvedDirectSlotCount
  ) {
    return fail("Configured DIRECT slot counts are inconsistent", {
      resolvedDirectEntryCount: entrants.length,
      unresolvedDirectSlotCount,
      configuredDirectSlotCount,
    });
  }

  const seenEntryIds = new Set();
  const reservations = Object.fromEntries(stages.map((stage) => [stage, 0]));
  let firstPlayableDirectEntryCount = 0;
  let firstPlayableDirectSlotCount = 0;
  let laterStageDirectEntryCount = 0;
  let laterStageDirectSlotCount = 0;

  for (const entrant of entrants) {
    const entryId = String(entrant?.entryId || "").trim();
    if (!entryId) {
      return fail("Canonical entryId required for DIRECT slot accounting", {
        entryId: null,
      });
    }
    if (seenEntryIds.has(entryId)) {
      return fail("Duplicate entryId in DIRECT slot accounting", { entryId });
    }
    seenEntryIds.add(entryId);

    const targetStage =
      entrant?.effectiveTargetStage || entrant?.targetStage || null;
    if (!Object.values(KNOCKOUT_ENTRY_ROUND).includes(targetStage)) {
      return fail("Valid effectiveTargetStage required for DIRECT slot accounting", {
        entryId,
        targetStage,
      });
    }
    if (
      !isDirectEntryTargetStageCompatible(targetStage, bracketWideEntryRound)
    ) {
      return fail(
        "DIRECT effectiveTargetStage cannot be earlier than bracketWideEntryRound",
        { entryId, targetStage, bracketWideEntryRound }
      );
    }

    if (targetStage === bracketWideEntryRound) {
      firstPlayableDirectEntryCount += 1;
      firstPlayableDirectSlotCount += 1;
      continue;
    }

    reservations[targetStage] += 1;
    laterStageDirectEntryCount += 1;
    laterStageDirectSlotCount += 1;
  }

  if (unresolvedDirectSlotCount > 0) {
    const unresolvedTargetStage = input.unresolvedTargetStage || null;
    if (!Object.values(KNOCKOUT_ENTRY_ROUND).includes(unresolvedTargetStage)) {
      return fail(
        "Valid policy targetStage required for unresolved DIRECT slot accounting",
        { unresolvedDirectSlotCount, targetStage: unresolvedTargetStage }
      );
    }
    if (
      !isDirectEntryTargetStageCompatible(
        unresolvedTargetStage,
        bracketWideEntryRound
      )
    ) {
      return fail(
        "Unresolved DIRECT targetStage cannot be earlier than bracketWideEntryRound",
        {
          unresolvedDirectSlotCount,
          targetStage: unresolvedTargetStage,
          bracketWideEntryRound,
        }
      );
    }

    if (unresolvedTargetStage === bracketWideEntryRound) {
      firstPlayableDirectSlotCount += unresolvedDirectSlotCount;
    } else {
      reservations[unresolvedTargetStage] += unresolvedDirectSlotCount;
      laterStageDirectSlotCount += unresolvedDirectSlotCount;
    }
  }

  const required = Object.fromEntries(stages.map((stage) => [stage, 0]));
  required[KNOCKOUT_ENTRY_ROUND.FINAL] = FINAL_REQUIRED_SLOTS;

  for (let index = stages.length - 2; index >= 0; index -= 1) {
    const stage = stages[index];
    const nextStage = stages[index + 1];
    const nextRequired = required[nextStage];
    const nextReservations = reservations[nextStage];

    if (nextReservations > nextRequired) {
      return fail("DIRECT reservations exceed required slots at knockout stage", {
        stage: nextStage,
        reservations: nextReservations,
        requiredSlots: nextRequired,
        behavior: "FAIL_CLOSED",
      });
    }

    const previousRequired = 2 * (nextRequired - nextReservations);
    const nominalCapacity = nominalStageCapacity(stage);
    if (
      !Number.isInteger(previousRequired) ||
      previousRequired < 0 ||
      nominalCapacity == null ||
      previousRequired > nominalCapacity
    ) {
      return fail("Backward DIRECT slot accounting produced impossible topology", {
        stage,
        nextStage,
        nextRequired,
        nextReservations,
        previousRequired,
        nominalCapacity,
        behavior: "FAIL_CLOSED",
      });
    }
    required[stage] = previousRequired;
  }

  for (const stage of stages) {
    if (reservations[stage] > required[stage]) {
      return fail("DIRECT reservations exceed required slots at knockout stage", {
        stage,
        reservations: reservations[stage],
        requiredSlots: required[stage],
        behavior: "FAIL_CLOSED",
      });
    }
  }

  const accountedDirectSlotCount =
    Object.values(reservations).reduce((sum, count) => sum + count, 0) +
    firstPlayableDirectSlotCount;
  if (accountedDirectSlotCount !== configuredDirectSlotCount) {
    return fail("DIRECT slot accounting must include every configured slot", {
      accountedDirectSlotCount,
      configuredDirectSlotCount,
      behavior: "FAIL_CLOSED",
    });
  }

  return Object.freeze({
    ok: true,
    code: null,
    message: null,
    details: Object.freeze({}),
    accounting: Object.freeze({
      enabled: laterStageDirectSlotCount > 0,
      bracketWideEntryRound,
      accountingDirection: "BACKWARD_FROM_FINAL",
      finalRequiredSlots: FINAL_REQUIRED_SLOTS,
      reservationsByStage: freezeStageCounts(stages, reservations),
      requiredEntrantsByStage: freezeStageCounts(stages, required),
      firstPlayableRequiredEntrants: required[bracketWideEntryRound],
      firstPlayableDirectEntryCount,
      firstPlayableDirectSlotCount,
      laterStageDirectEntryCount,
      laterStageDirectSlotCount,
      resolvedDirectEntryCount: entrants.length,
      unresolvedDirectSlotCount,
      configuredDirectSlotCount,
      reservationAccountingComplete: true,
      topologyValid: true,
      admissionOnly: true,
      placementIncluded: false,
    }),
  });
}
