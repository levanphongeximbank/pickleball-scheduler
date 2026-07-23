/**
 * CORE-19 Workflow adapter — public barrel only.
 */

import { createWorkflowDefinition } from "../../workflow/index.js";
import { COMPATIBILITY_STATUS } from "../constants.js";
import { isPlainObject } from "../utils/helpers.js";
import { defaultValidatePayload } from "./registry.js";

export const CORE19_MODULE_ID = "workflow";
export const CORE19_ADAPTER_VERSION = "1.0.0";

/**
 * @returns {import("./registry.js").ModuleAdapter}
 */
export function createCore19WorkflowAdapter() {
  return {
    moduleId: CORE19_MODULE_ID,
    coreId: "CORE-19",
    supportedVersions: [CORE19_ADAPTER_VERSION],
    requiresDomainAdapter: false,
    validatePayload(payload) {
      const base = defaultValidatePayload(payload);
      if (!base.ok) return base;
      if (!isPlainObject(payload) && !Array.isArray(payload)) {
        return {
          ok: false,
          errors: [
            {
              code: "INVALID_WORKFLOW_PAYLOAD",
              message: "Workflow payload must be object or array",
            },
          ],
        };
      }
      // Soft-validate definition shape when present.
      if (isPlainObject(payload) && payload.definition != null) {
        try {
          createWorkflowDefinition(payload.definition);
        } catch (err) {
          return {
            ok: false,
            errors: [
              {
                code: "INVALID_WORKFLOW_DEFINITION",
                message:
                  err instanceof Error
                    ? err.message
                    : "Invalid workflow definition",
              },
            ],
          };
        }
      }
      return { ok: true, errors: [] };
    },
    normalize(payload) {
      if (payload == null) return { definitions: [] };
      if (Array.isArray(payload)) return { definitions: payload };
      return payload;
    },
    extractReferences(payload) {
      const refs = [];
      if (isPlainObject(payload) && Array.isArray(payload.references)) {
        for (const r of payload.references) {
          if (isPlainObject(r) && typeof r.id === "string") {
            refs.push({
              sourceNamespace: "workflow",
              sourceReference: r.id,
              entityType: r.entityType ?? "workflow",
            });
          }
        }
      }
      return refs;
    },
    stableOrder(payload) {
      return payload;
    },
    evaluateCompatibility(payload, ctx = {}) {
      const version = ctx.moduleVersion ?? "1.0.0";
      const supported = this.supportedVersions.includes(String(version));
      return {
        status: supported
          ? COMPATIBILITY_STATUS.COMPATIBLE
          : COMPATIBILITY_STATUS.REQUIRES_ADAPTER,
        requiredAdapters: supported ? [] : ["core19.workflow.version-adapter"],
      };
    },
    importMappingHints(payload) {
      return this.extractReferences(payload);
    },
  };
}
