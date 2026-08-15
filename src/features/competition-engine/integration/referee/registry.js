/**
 * CompetitionRefereeAdapterRegistry — resolve by canonical competition mode.
 * Fail-closed, deterministic, does not mutate adapter state.
 */

import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_MODE_VALUES,
  REFEREE_ADAPTER_ERROR_CODE,
} from "./constants.js";
import {
  assertCompetitionRefereeAdapter,
  freezeRefereeAdapterView,
  normalizeRefereeAdapterMode,
} from "./contract.js";
import { failRefereeAdapter } from "./errors.js";
import { isPlainObject } from "./helpers.js";

/**
 * @param {{ adapters?: unknown[] }} [input]
 */
export function createCompetitionRefereeAdapterRegistry(input = {}) {
  if (!isPlainObject(input)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Registry input must be a plain object",
      {}
    );
  }

  /** @type {Map<string, object>} */
  const byMode = new Map();
  const adaptersRaw = Array.isArray(input.adapters) ? input.adapters : [];

  for (let i = 0; i < adaptersRaw.length; i += 1) {
    const adapter = adaptersRaw[i];
    const validated = freezeRefereeAdapterView(
      assertCompetitionRefereeAdapter(adapter)
    );
    if (byMode.has(validated.competitionMode)) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DUPLICATE_MODE,
        `Adapter already registered for mode ${validated.competitionMode}`,
        { mode: validated.competitionMode, index: i }
      );
    }
    byMode.set(validated.competitionMode, validated);
  }

  let frozen = true;

  const registry = Object.freeze({
    kind: "competition-referee-adapter-registry",
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    frozen: true,
    size() {
      return byMode.size;
    },
    listModes() {
      return Object.freeze(
        [...byMode.keys()].sort((a, b) => a.localeCompare(b))
      );
    },
    has(mode) {
      try {
        return byMode.has(normalizeRefereeAdapterMode(mode));
      } catch {
        return false;
      }
    },
    /**
     * @param {string} mode
     */
    resolve(mode) {
      const normalized = normalizeRefereeAdapterMode(mode);
      const adapter = byMode.get(normalized);
      if (!adapter) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE,
          `No referee adapter registered for mode ${normalized}`,
          {
            mode: normalized,
            registered: [...byMode.keys()],
            knownModes: [...COMPETITION_REFEREE_MODE_VALUES],
          }
        );
      }
      return adapter;
    },
    register() {
      if (frozen) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.REGISTRY_FROZEN,
          "CompetitionRefereeAdapterRegistry is immutable after creation",
          {}
        );
      }
    },
  });

  return registry;
}
