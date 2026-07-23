/**
 * Registry-based support for CORE-01 .. CORE-18 via public contracts.
 * When domain semantics are unavailable from the public API, adapters are
 * marked requiresDomainAdapter → compatibility REQUIRES_ADAPTER.
 */

import { COMPATIBILITY_STATUS } from "../constants.js";
import { isPlainObject } from "../utils/helpers.js";
import { defaultValidatePayload } from "./registry.js";

/**
 * Module catalog for CORE-01..18.
 * `requiresDomainAdapter: true` means portable packaging is supported but
 * full domain import semantics need a dedicated adapter (public API insufficient).
 */
export const CORE_01_TO_18_CATALOG = Object.freeze([
  { moduleId: "constraints", coreId: "CORE-01", requiresDomainAdapter: false },
  { moduleId: "role-permission", coreId: "CORE-02", requiresDomainAdapter: false },
  {
    moduleId: "registration-eligibility",
    coreId: "CORE-03",
    requiresDomainAdapter: false,
  },
  { moduleId: "draw", coreId: "CORE-04", requiresDomainAdapter: false },
  { moduleId: "formation", coreId: "CORE-05", requiresDomainAdapter: false },
  { moduleId: "lineups", coreId: "CORE-06", requiresDomainAdapter: false },
  { moduleId: "seeding", coreId: "CORE-07", requiresDomainAdapter: false },
  {
    moduleId: "group-placement",
    coreId: "CORE-08",
    requiresDomainAdapter: true,
  },
  {
    moduleId: "match-generation",
    coreId: "CORE-09",
    requiresDomainAdapter: false,
  },
  { moduleId: "optimizer", coreId: "CORE-10", requiresDomainAdapter: true },
  {
    moduleId: "schedule-engine",
    coreId: "CORE-11",
    requiresDomainAdapter: false,
  },
  {
    moduleId: "court-assignment",
    coreId: "CORE-12",
    requiresDomainAdapter: false,
  },
  {
    moduleId: "referee-assignment",
    coreId: "CORE-13",
    requiresDomainAdapter: false,
  },
  {
    moduleId: "resource-conflict",
    coreId: "CORE-14",
    requiresDomainAdapter: false,
  },
  { moduleId: "matches", coreId: "CORE-15", requiresDomainAdapter: false },
  { moduleId: "scoring", coreId: "CORE-16", requiresDomainAdapter: false },
  {
    moduleId: "result-validation",
    coreId: "CORE-17",
    requiresDomainAdapter: false,
  },
  { moduleId: "standings", coreId: "CORE-18", requiresDomainAdapter: false },
]);

/**
 * @param {{ moduleId: string, coreId: string, requiresDomainAdapter: boolean }} entry
 * @returns {import("./registry.js").ModuleAdapter}
 */
export function createGenericPublicAdapter(entry) {
  return {
    moduleId: entry.moduleId,
    coreId: entry.coreId,
    supportedVersions: ["1.0.0"],
    requiresDomainAdapter: Boolean(entry.requiresDomainAdapter),
    validatePayload(payload) {
      return defaultValidatePayload(payload);
    },
    normalize(payload) {
      if (payload == null) return {};
      return payload;
    },
    extractReferences(payload) {
      const refs = [];
      if (!isPlainObject(payload)) return refs;
      if (Array.isArray(payload.entities)) {
        for (const e of payload.entities) {
          if (isPlainObject(e) && typeof e.id === "string") {
            refs.push({
              sourceNamespace: entry.moduleId,
              sourceReference: e.id,
              sourceId: e.id,
              entityType: e.entityType ?? entry.moduleId,
              parentId: e.parentId ?? null,
            });
          }
        }
      }
      return refs;
    },
    evaluateCompatibility(payload, ctx = {}) {
      if (entry.requiresDomainAdapter) {
        return {
          status: COMPATIBILITY_STATUS.REQUIRES_ADAPTER,
          requiredAdapters: [`${entry.coreId.toLowerCase()}.${entry.moduleId}`],
        };
      }
      const version = String(ctx.moduleVersion ?? "1.0.0");
      if (version !== "1.0.0") {
        return {
          status: COMPATIBILITY_STATUS.REQUIRES_ADAPTER,
          requiredAdapters: [
            `${entry.coreId.toLowerCase()}.${entry.moduleId}.version-adapter`,
          ],
        };
      }
      return { status: COMPATIBILITY_STATUS.COMPATIBLE, requiredAdapters: [] };
    },
    importMappingHints(payload) {
      return this.extractReferences(payload).map((r) => ({
        ...r,
        // Action left unset so mappingPolicy.defaultAction applies.
      }));
    },
  };
}

/**
 * @param {ReturnType<import("./registry.js").createAdapterRegistry>} registry
 */
export function registerCore01To18Adapters(registry) {
  for (const entry of CORE_01_TO_18_CATALOG) {
    registry.register(createGenericPublicAdapter(entry));
  }
}
