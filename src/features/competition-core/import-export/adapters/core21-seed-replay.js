/**
 * CORE-21 Deterministic Seed & Replay adapter — public barrel only.
 * Transports seed/replay references; does not generate seeds or run replay.
 */

import {
  CORE21_ENGINE_VERSION,
  CORE21_REPLAY_CONTRACT_VERSION,
  createSeedIdentity,
  createReplayContext,
} from "../../deterministic-seed-replay/index.js";
import { COMPATIBILITY_STATUS } from "../constants.js";
import { isPlainObject } from "../utils/helpers.js";
import { defaultValidatePayload } from "./registry.js";

export const CORE21_MODULE_ID = "deterministic-seed-replay";

/**
 * @returns {import("./registry.js").ModuleAdapter}
 */
export function createCore21SeedReplayAdapter() {
  return {
    moduleId: CORE21_MODULE_ID,
    coreId: "CORE-21",
    supportedVersions: [
      String(CORE21_ENGINE_VERSION || "1.0.0"),
      String(CORE21_REPLAY_CONTRACT_VERSION || "1.0.0"),
      "1.0.0",
    ],
    requiresDomainAdapter: false,
    validatePayload(payload) {
      const base = defaultValidatePayload(payload);
      if (!base.ok) return base;
      if (!isPlainObject(payload)) {
        return {
          ok: false,
          errors: [
            {
              code: "INVALID_SEED_REPLAY_PAYLOAD",
              message: "Seed/replay payload must be a plain object",
            },
          ],
        };
      }
      return { ok: true, errors: [] };
    },
    normalize(payload) {
      if (!isPlainObject(payload)) {
        return { seedReferences: [], replayReferences: [], fingerprints: [] };
      }
      return {
        seedReferences: Array.isArray(payload.seedReferences)
          ? payload.seedReferences
          : [],
        replayReferences: Array.isArray(payload.replayReferences)
          ? payload.replayReferences
          : [],
        algorithmVersions: isPlainObject(payload.algorithmVersions)
          ? payload.algorithmVersions
          : {},
        fingerprints: Array.isArray(payload.fingerprints)
          ? payload.fingerprints
          : [],
      };
    },
    extractReferences(payload) {
      const refs = [];
      if (!isPlainObject(payload)) return refs;
      for (const key of ["seedReferences", "replayReferences"]) {
        const list = Array.isArray(payload[key]) ? payload[key] : [];
        for (const r of list) {
          if (typeof r === "string") {
            refs.push({
              sourceNamespace: "seed-replay",
              sourceReference: r,
              entityType: key,
            });
          } else if (isPlainObject(r) && typeof r.id === "string") {
            refs.push({
              sourceNamespace: "seed-replay",
              sourceReference: r.id,
              entityType: key,
            });
          }
        }
      }
      // Soft-validate shapes via public factories when present.
      if (isPlainObject(payload.seedIdentity)) {
        try {
          createSeedIdentity(payload.seedIdentity);
        } catch {
          /* soft */
        }
      }
      if (isPlainObject(payload.replayContext)) {
        try {
          createReplayContext(payload.replayContext);
        } catch {
          /* soft */
        }
      }
      return refs;
    },
    evaluateCompatibility(payload, ctx = {}) {
      const version = String(ctx.moduleVersion ?? "1.0.0");
      const supported = this.supportedVersions.includes(version);
      return {
        status: supported
          ? COMPATIBILITY_STATUS.COMPATIBLE
          : COMPATIBILITY_STATUS.REQUIRES_ADAPTER,
        requiredAdapters: supported
          ? []
          : ["core21.deterministic-seed-replay.version-adapter"],
      };
    },
    importMappingHints(payload) {
      return this.extractReferences(payload);
    },
  };
}
