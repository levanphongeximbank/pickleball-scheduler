/**
 * localStorage retirement helpers (COACHING-04) — detect/classify ONLY.
 *
 * LOCALSTORAGE_RETIRED remains false. No silent upload. No delete activation.
 */

import {
  COACHING_LEGACY_STORAGE_KEY_PREFIX,
  LOCALSTORAGE_RETIRED,
  COACHING_UI_COLLECTIONS,
} from "./constants.js";
import {
  createCoachingRuntimeError,
  COACHING_RUNTIME_ERROR_CODES,
} from "./errors.js";

/**
 * @param {string} clubId
 * @param {Storage} [storage]
 * @returns {object|null}
 */
export function detectLegacyStore(clubId, storage = globalThis.localStorage) {
  const id = String(clubId || "").trim();
  if (!id || !storage || typeof storage.getItem !== "function") return null;
  const key = `${COACHING_LEGACY_STORAGE_KEY_PREFIX}::${id}`;
  const raw = storage.getItem(key);
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return Object.freeze({ parseError: true, key });
  }
}

/**
 * Heuristic classification of a legacy store blob.
 * @param {object|null|undefined} store
 * @returns {"empty"|"demo"|"user-created"}
 */
export function classifyLegacyStore(store) {
  if (!store || store.parseError) return "empty";

  const collections = COACHING_UI_COLLECTIONS;
  const lengths = collections.map((key) =>
    Array.isArray(store[key]) ? store[key].length : 0
  );
  if (lengths.every((n) => n === 0)) return "empty";

  // Known demo patterns (prototype seed markers) — extend carefully if seeds appear.
  const demoMarkers = ["demo-", "seed-", "DEMO_", "__demo"];
  const sampleRows = collections.flatMap((key) =>
    Array.isArray(store[key]) ? store[key].slice(0, 5) : []
  );
  const looksDemo =
    sampleRows.length > 0 &&
    sampleRows.every((row) => {
      const id = String(row?.id || "");
      const name = String(row?.name || "");
      return demoMarkers.some((m) => id.includes(m) || name.includes(m));
    });
  if (looksDemo) return "demo";

  return "user-created";
}

/**
 * Build a retirement plan. Requires explicit confirmation.
 * Never activates deletion or silent cloud upload while LOCALSTORAGE_RETIRED is false.
 *
 * @param {{ clubId?: string, confirmed?: boolean, storage?: Storage }} [input]
 */
export function buildRetirementPlan(input = {}) {
  assertRetirementNotActivated();

  const clubId = String(input.clubId || "").trim();
  const store = clubId ? detectLegacyStore(clubId, input.storage) : null;
  const classification = classifyLegacyStore(store);

  if (!input.confirmed) {
    return Object.freeze({
      ok: false,
      activated: false,
      localStorageRetired: LOCALSTORAGE_RETIRED,
      classification,
      error: "Explicit confirmation required before any retirement plan proceeds.",
      code: COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
      silentUpload: false,
    });
  }

  // Even with confirmation, COACHING-04 does not activate retirement.
  return Object.freeze({
    ok: false,
    activated: false,
    localStorageRetired: LOCALSTORAGE_RETIRED,
    classification,
    clubId: clubId || null,
    steps: Object.freeze([
      "Inventory legacy keys (detectLegacyStore)",
      "Classify empty | demo | user-created",
      "Owner-approved migration path (not auto-upload)",
      "Activate LOCALSTORAGE_RETIRED only after Owner authorization",
    ]),
    error:
      "localStorage retirement is deferred — LOCALSTORAGE_RETIRED remains false; no deletion activated.",
    silentUpload: false,
  });
}

/**
 * Guard: retirement must not be treated as activated in this phase.
 * @returns {true}
 */
export function assertRetirementNotActivated() {
  if (LOCALSTORAGE_RETIRED === true) {
    throw Object.assign(
      new Error(
        "LOCALSTORAGE_RETIRED unexpectedly true — retirement activation is not authorized in COACHING-04 cutover authoring."
      ),
      createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        "localStorage retirement must not be activated."
      )
    );
  }
  return true;
}
