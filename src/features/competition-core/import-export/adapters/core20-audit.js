/**
 * CORE-20 Audit adapter — references-only boundary.
 * Does not append audit events or manage sequences.
 */

import {
  COMPETITION_AUDIT_SCHEMA_VERSION,
  createActorReference,
  createSubjectReference,
} from "../../audit/index.js";
import { AUDIT_SECTION_POLICY, COMPATIBILITY_STATUS } from "../constants.js";
import { isPlainObject } from "../utils/helpers.js";
import { defaultValidatePayload } from "./registry.js";

export const CORE20_MODULE_ID = "audit";

/**
 * @returns {import("./registry.js").ModuleAdapter}
 */
export function createCore20AuditAdapter() {
  return {
    moduleId: CORE20_MODULE_ID,
    coreId: "CORE-20",
    supportedVersions: [
      String(COMPETITION_AUDIT_SCHEMA_VERSION || "1.0.0"),
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
              code: "INVALID_AUDIT_PAYLOAD",
              message: "Audit payload must be a plain object",
            },
          ],
        };
      }
      // Reject full event dumps by default profile contract.
      if (Array.isArray(payload.events) && payload.events.length > 0) {
        return {
          ok: false,
          errors: [
            {
              code: "AUDIT_FULL_PAYLOAD_FORBIDDEN",
              message:
                "CORE-22 must not transport full CORE-20 audit event payloads",
            },
          ],
        };
      }
      if (
        payload.policy != null &&
        payload.policy !== AUDIT_SECTION_POLICY.REFERENCES_ONLY &&
        payload.policy !== AUDIT_SECTION_POLICY.OMIT
      ) {
        return {
          ok: false,
          errors: [
            {
              code: "AUDIT_POLICY_UNSUPPORTED",
              message: "Unsupported audit section policy",
            },
          ],
        };
      }
      return { ok: true, errors: [] };
    },
    normalize(payload) {
      if (!isPlainObject(payload)) {
        return {
          policy: AUDIT_SECTION_POLICY.REFERENCES_ONLY,
          references: [],
        };
      }
      return {
        policy: payload.policy ?? AUDIT_SECTION_POLICY.REFERENCES_ONLY,
        references: Array.isArray(payload.references) ? payload.references : [],
      };
    },
    extractReferences(payload) {
      const refs = [];
      const list =
        isPlainObject(payload) && Array.isArray(payload.references)
          ? payload.references
          : [];
      for (const r of list) {
        if (!isPlainObject(r)) continue;
        const id =
          typeof r.eventId === "string"
            ? r.eventId
            : typeof r.id === "string"
              ? r.id
              : null;
        if (id) {
          refs.push({
            sourceNamespace: "audit",
            sourceReference: id,
            entityType: "audit_reference",
          });
        }
        // Soft-touch public envelope helpers when actor/subject shapes present.
        if (isPlainObject(r.actor)) {
          try {
            createActorReference(r.actor);
          } catch {
            /* allowlisted reference validation is soft here */
          }
        }
        if (isPlainObject(r.subject)) {
          try {
            createSubjectReference(r.subject);
          } catch {
            /* soft */
          }
        }
      }
      return refs;
    },
    evaluateCompatibility() {
      return { status: COMPATIBILITY_STATUS.COMPATIBLE, requiredAdapters: [] };
    },
    importMappingHints(payload) {
      return this.extractReferences(payload).map((r) => ({
        ...r,
        action: "EXTERNAL_REFERENCE",
      }));
    },
  };
}
