/**
 * CORE-12 Phase 1C-R — fixture manifest builder (certification).
 */

import { createTeParityFixtureCatalog } from "./catalog.js";

/** Required fixture IDs F01–F30 (stable catalog keys). */
export const REQUIRED_TE_PARITY_FIXTURE_IDS = Object.freeze([
  "F01_one_match_one_court",
  "F02_multi_match_multi_court",
  "F03_adjacent_non_overlap",
  "F04_positive_overlap",
  "F05_court_unavailable_full",
  "F06_disabled_court",
  "F07_multi_venue_input",
  "F08_missing_venue_scope",
  "F09_missing_scheduled_interval",
  "F10_duplicate_match_id",
  "F11_duplicate_court_id",
  "F12_capability_compatible",
  "F13_capability_incompatible",
  "F14_valid_locked_assignment",
  "F15_locked_assignment_overlap",
  "F16_unknown_locked_court",
  "F17_partial_allowed",
  "F18_partial_forbidden",
  "F19_input_permuted",
  "F20_legacy_order_dependence",
  "F21_legacy_first_court_fallback",
  "F22_legacy_ambiguous_ok",
  "F23_legacy_mutation_behavior",
  "F24_empty_match_set",
  "F25_empty_court_set",
  "F26_timezone_less_time",
  "F27_invalid_calendar_date",
  "F28_cross_tenant_club",
  "F29_multiple_availability_intervals",
  "F30_adjacent_intervals_no_merge",
]);

/**
 * @param {object} fx
 */
function toManifestEntry(fx) {
  const representable =
    fx.expectedClassification !== "UNREPRESENTABLE_LEGACY_INPUT" &&
    fx.fixtureInvalid !== true;
  const legacySafe = fx.legacyUnsafe !== true;
  return Object.freeze({
    fixtureId: fx.id,
    title: fx.title || fx.id,
    category: fx.category,
    legacyBehaviorUnderTest: fx.legacyBehaviorUnderTest || fx.id,
    expectedClassification: fx.expectedClassification,
    divergenceIds: Object.freeze(
      Array.isArray(fx.divergenceIds) ? [...fx.divergenceIds] : []
    ),
    representableByCore12: representable,
    legacyBehaviorSafe: legacySafe,
    sourceBehavior: fx.sourceBehavior || "TE assignCourts LEGACY-mode reference",
    expectCore12Valid: fx.expectCore12Valid === true,
    allowInfeasible: fx.allowInfeasible === true,
  });
}

/**
 * @returns {ReadonlyArray<object>}
 */
export function buildTeParityFixtureManifest() {
  const catalog = createTeParityFixtureCatalog();
  return Object.freeze(catalog.map((fx) => toManifestEntry(fx)));
}

/**
 * @returns {{ ok: boolean, errors: readonly string[], fixtureCount: number, uniqueIds: readonly string[] }}
 */
export function certifyTeParityFixtureManifest() {
  const catalog = createTeParityFixtureCatalog();
  /** @type {string[]} */
  const errors = [];
  const ids = catalog.map((f) => f.id);
  const unique = [...new Set(ids)];

  if (catalog.length !== 30) {
    errors.push(`expected 30 fixtures, found ${catalog.length}`);
  }
  if (unique.length !== ids.length) {
    errors.push("duplicate fixture ids present");
  }
  for (const required of REQUIRED_TE_PARITY_FIXTURE_IDS) {
    if (!ids.includes(required)) {
      errors.push(`missing required fixture id ${required}`);
    }
  }
  for (const fx of catalog) {
    if (!fx.expectedClassification) {
      errors.push(`${fx.id} missing expectedClassification`);
    }
    if (typeof fx.category !== "number" || fx.category < 1 || fx.category > 30) {
      errors.push(`${fx.id} invalid category`);
    }
  }
  const categories = new Set(catalog.map((f) => f.category));
  for (let i = 1; i <= 30; i += 1) {
    if (!categories.has(i)) errors.push(`missing category ${i}`);
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    fixtureCount: catalog.length,
    uniqueIds: Object.freeze(unique.sort()),
  });
}
