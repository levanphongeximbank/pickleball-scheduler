import { deepFreeze } from "../domain/deepFreeze.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";

/**
 * Fixture/test-only comparison between canonical CORE-07 assignments and an
 * explicitly supplied legacy seeding output. Does not call Production services.
 *
 * Legacy remains authoritative until a later Owner-approved migration phase.
 *
 * @param {{
 *   canonicalAssignments: ReadonlyArray<{ entryId: string, seedNumber: number, eligibilityStatus?: string }>,
 *   legacyAssignments: ReadonlyArray<{ entryId: string, seedNumber: number, eligibilityStatus?: string }>,
 *   comparisonId?: string,
 * }} input
 * @returns {Readonly<object>}
 */
export function compareLegacyAndCanonicalSeeding(input) {
  if (!input || typeof input !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.SHADOW_COMPARISON_INPUT_INVALID,
      "compareLegacyAndCanonicalSeeding input is required"
    );
  }
  if (!Array.isArray(input.canonicalAssignments)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SHADOW_COMPARISON_INPUT_INVALID,
      "canonicalAssignments must be an array"
    );
  }
  if (!Array.isArray(input.legacyAssignments)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SHADOW_COMPARISON_INPUT_INVALID,
      "legacyAssignments must be an array"
    );
  }

  /** @type {Map<string, { entryId: string, seedNumber: number, eligibilityStatus?: string }>} */
  const canonical = new Map();
  for (const row of input.canonicalAssignments) {
    if (!row || row.entryId == null || row.seedNumber == null) {
      throwSeedingError(
        SEEDING_ERROR_CODE.SHADOW_COMPARISON_INPUT_INVALID,
        "canonical assignment requires entryId and seedNumber"
      );
    }
    canonical.set(String(row.entryId), row);
  }
  /** @type {Map<string, { entryId: string, seedNumber: number, eligibilityStatus?: string }>} */
  const legacy = new Map();
  for (const row of input.legacyAssignments) {
    if (!row || row.entryId == null || row.seedNumber == null) {
      throwSeedingError(
        SEEDING_ERROR_CODE.SHADOW_COMPARISON_INPUT_INVALID,
        "legacy assignment requires entryId and seedNumber"
      );
    }
    legacy.set(String(row.entryId), row);
  }

  /** @type {object[]} */
  const differences = [];
  const allIds = Array.from(
    new Set([...canonical.keys(), ...legacy.keys()])
  ).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const entryId of allIds) {
    const c = canonical.get(entryId);
    const l = legacy.get(entryId);
    if (c && !l) {
      differences.push({
        code: "ENTRY_ONLY_IN_CANONICAL",
        entryId,
        canonicalSeedNumber: c.seedNumber,
      });
      continue;
    }
    if (l && !c) {
      differences.push({
        code: "ENTRY_ONLY_IN_LEGACY",
        entryId,
        legacySeedNumber: l.seedNumber,
      });
      continue;
    }
    if (c && l) {
      if (Number(c.seedNumber) !== Number(l.seedNumber)) {
        differences.push({
          code: "SEED_NUMBER_MISMATCH",
          entryId,
          canonicalSeedNumber: c.seedNumber,
          legacySeedNumber: l.seedNumber,
        });
      }
      const cElig = c.eligibilityStatus;
      const lElig = l.eligibilityStatus;
      if (
        cElig != null &&
        lElig != null &&
        String(cElig) !== String(lElig)
      ) {
        differences.push({
          code: "ELIGIBILITY_MISMATCH",
          entryId,
          canonicalEligibility: cElig,
          legacyEligibility: lElig,
        });
      }
    }
  }

  // Ordering mismatch: compare entry order by ascending seed number.
  const canonOrder = [...canonical.values()]
    .sort((a, b) => a.seedNumber - b.seedNumber || String(a.entryId).localeCompare(String(b.entryId)))
    .map((r) => String(r.entryId));
  const legacyOrder = [...legacy.values()]
    .sort((a, b) => a.seedNumber - b.seedNumber || String(a.entryId).localeCompare(String(b.entryId)))
    .map((r) => String(r.entryId));
  if (canonOrder.join("|") !== legacyOrder.join("|")) {
    differences.push({
      code: "ORDERING_MISMATCH",
      canonicalOrder: canonOrder,
      legacyOrder,
    });
  }

  differences.sort((a, b) => {
    const ac = String(a.code);
    const bc = String(b.code);
    if (ac !== bc) return ac < bc ? -1 : 1;
    const ae = String(a.entryId || "");
    const be = String(b.entryId || "");
    return ae < be ? -1 : ae > be ? 1 : 0;
  });

  return deepFreeze({
    comparisonId: input.comparisonId || null,
    equal: differences.length === 0,
    differences: deepFreeze(differences),
    metadata: deepFreeze({
      legacyRemainsAuthoritative: true,
      productionWrites: false,
      featureActivation: false,
      note:
        "Legacy production seeding remains authoritative until a later Owner-approved migration phase.",
    }),
  });
}
