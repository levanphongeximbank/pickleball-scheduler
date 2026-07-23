/**
 * CORE-22 adapter registry — versioned module-section adapters.
 */

import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  compareStableString,
  isNonEmptyString,
  isPlainObject,
} from "../utils/helpers.js";

export const ADAPTER_REGISTRY_VERSION = "core22.adapter-registry.v1";

/**
 * @typedef {Object} ModuleAdapter
 * @property {string} moduleId
 * @property {ReadonlyArray<string>} supportedVersions
 * @property {(payload: unknown, ctx?: object) => { ok: boolean, errors?: object[] }} [validatePayload]
 * @property {(payload: unknown, ctx?: object) => unknown} [normalize]
 * @property {(payload: unknown, ctx?: object) => object[]} [extractReferences]
 * @property {(payload: unknown, ctx?: object) => unknown} [stableOrder]
 * @property {(payload: unknown, ctx?: object) => object} [evaluateCompatibility]
 * @property {(payload: unknown, ctx?: object) => object[]} [importMappingHints]
 * @property {boolean} [requiresDomainAdapter]
 * @property {string} [coreId]
 */

/**
 * @returns {{
 *   version: string,
 *   register: (adapter: ModuleAdapter) => void,
 *   resolve: (moduleId: string) => ModuleAdapter|null,
 *   has: (moduleId: string) => boolean,
 *   list: () => ReadonlyArray<ModuleAdapter>,
 *   freeze: () => void,
 *   isFrozen: () => boolean,
 *   size: () => number,
 * }}
 */
export function createAdapterRegistry() {
  /** @type {Map<string, ModuleAdapter>} */
  const adapters = new Map();
  let frozen = false;

  return {
    version: ADAPTER_REGISTRY_VERSION,
    register(adapter) {
      if (frozen) {
        throw new ImportExportError(
          IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED,
          "Adapter registry is frozen",
          {}
        );
      }
      if (!isPlainObject(adapter) || !isNonEmptyString(adapter.moduleId)) {
        throw new ImportExportError(
          IMPORT_EXPORT_ERROR_CODE.INCOMPATIBLE_PACKAGE,
          "Adapter must declare moduleId",
          {}
        );
      }
      const moduleId = String(adapter.moduleId).trim();
      if (adapters.has(moduleId)) {
        throw new ImportExportError(
          IMPORT_EXPORT_ERROR_CODE.DUPLICATE_ID,
          `Adapter already registered for ${moduleId}`,
          { moduleId }
        );
      }
      const supportedVersions = Array.isArray(adapter.supportedVersions)
        ? Object.freeze(adapter.supportedVersions.map((v) => String(v).trim()))
        : Object.freeze(["1.0.0"]);

      adapters.set(
        moduleId,
        Object.freeze({
          moduleId,
          supportedVersions,
          coreId: adapter.coreId ?? null,
          requiresDomainAdapter: Boolean(adapter.requiresDomainAdapter),
          validatePayload: adapter.validatePayload ?? null,
          normalize: adapter.normalize ?? null,
          extractReferences: adapter.extractReferences ?? null,
          stableOrder: adapter.stableOrder ?? null,
          evaluateCompatibility: adapter.evaluateCompatibility ?? null,
          importMappingHints: adapter.importMappingHints ?? null,
        })
      );
    },
    resolve(moduleId) {
      return adapters.get(String(moduleId).trim()) ?? null;
    },
    has(moduleId) {
      return adapters.has(String(moduleId).trim());
    },
    list() {
      return Object.freeze(
        [...adapters.values()].sort((a, b) =>
          compareStableString(a.moduleId, b.moduleId)
        )
      );
    },
    freeze() {
      frozen = true;
    },
    isFrozen() {
      return frozen;
    },
    size() {
      return adapters.size;
    },
  };
}

/**
 * Default no-op validation.
 * @param {unknown} payload
 * @returns {{ ok: boolean, errors: object[] }}
 */
export function defaultValidatePayload(payload) {
  if (payload === undefined) {
    return {
      ok: false,
      errors: [{ code: "EMPTY_PAYLOAD", message: "Payload is undefined" }],
    };
  }
  return { ok: true, errors: [] };
}
