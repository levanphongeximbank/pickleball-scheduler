/**
 * Intelligence use-case registry (I&A-12).
 * Explicit factory — no global mutable singleton.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  INTELLIGENCE_USE_CASE_LIFECYCLE,
  INTELLIGENCE_WARNING_CODE,
} from "./enums.js";
import { createIntelligenceUseCaseDefinition } from "./useCase.js";
import { createSafeCanonicalFingerprint } from "./provenance.js";

export const INTELLIGENCE_USE_CASE_REGISTRATION_STATUS = Object.freeze({
  REGISTERED: "REGISTERED",
  IDEMPOTENT: "IDEMPOTENT",
});

/**
 * @param {string} useCaseId
 * @param {string} version
 * @returns {string}
 */
export function intelligenceUseCaseIdentityKey(useCaseId, version) {
  return `${useCaseId}::${version}`;
}

/**
 * @param {unknown} existing
 * @param {unknown} incoming
 * @returns {import("../contracts/result.js").Result}
 */
function classifyRegistration(existing, incoming) {
  const existingFp = createSafeCanonicalFingerprint({
    useCaseId: existing.useCaseId,
    version: existing.version,
    title: existing.title,
    description: existing.description,
    owner: existing.owner,
    riskTier: existing.riskTier,
    lifecycleStatus: existing.lifecycleStatus,
    featureSchemaReference: existing.featureSchemaReference,
    outputSchemaReference: existing.outputSchemaReference,
    humanReviewRequirement: existing.humanReviewRequirement,
    fallbackPolicy: existing.fallbackPolicy,
    abstentionPolicy: existing.abstentionPolicy,
  });
  const incomingFp = createSafeCanonicalFingerprint({
    useCaseId: incoming.useCaseId,
    version: incoming.version,
    title: incoming.title,
    description: incoming.description,
    owner: incoming.owner,
    riskTier: incoming.riskTier,
    lifecycleStatus: incoming.lifecycleStatus,
    featureSchemaReference: incoming.featureSchemaReference,
    outputSchemaReference: incoming.outputSchemaReference,
    humanReviewRequirement: incoming.humanReviewRequirement,
    fallbackPolicy: incoming.fallbackPolicy,
    abstentionPolicy: incoming.abstentionPolicy,
  });

  if (existingFp === incomingFp) {
    return ok(
      deepFreeze({
        status: INTELLIGENCE_USE_CASE_REGISTRATION_STATUS.IDEMPOTENT,
        entry: existing,
      })
    );
  }

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.INTELLIGENCE_REGISTRY_CONFLICT,
      "Conflicting use-case registration for same ID/version",
      "registry",
      {
        useCaseId: existing.useCaseId,
        version: existing.version,
      }
    )
  );
}

/**
 * @param {ReadonlyArray<*>} ordered
 * @returns {Readonly<*>}
 */
function buildReadOnlyRegistry(ordered) {
  const byIdentity = new Map(
    ordered.map((entry) => [
      intelligenceUseCaseIdentityKey(entry.useCaseId, entry.version),
      entry,
    ])
  );

  return deepFreeze({
    size: ordered.length,
    /**
     * Exact ID/version lookup — never selects latest.
     * @param {string} useCaseId
     * @param {string} version
     */
    getExact(useCaseId, version) {
      if (!isNonEmptyString(useCaseId) || !isNonEmptyString(version)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_REGISTRY_NOT_FOUND,
            "Exact use-case lookup requires useCaseId and version",
            "lookup"
          )
        );
      }
      const entry = byIdentity.get(
        intelligenceUseCaseIdentityKey(String(useCaseId).trim(), String(version).trim())
      );
      if (!entry) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_REGISTRY_NOT_FOUND,
            "Use case not found for exact ID/version",
            "lookup",
            { useCaseId, version }
          )
        );
      }

      /** @type {Array<{ code: string, message: string }>} */
      const warnings = [];
      if (entry.lifecycleStatus === INTELLIGENCE_USE_CASE_LIFECYCLE.DEPRECATED) {
        warnings.push(
          Object.freeze({
            code: INTELLIGENCE_WARNING_CODE.USE_CASE_DEPRECATED,
            message: "Deprecated use case — prefer replacement when available",
          })
        );
      }

      if (entry.lifecycleStatus === INTELLIGENCE_USE_CASE_LIFECYCLE.RETIRED) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_RETIRED,
            "Retired use case rejected",
            "lookup",
            { useCaseId, version }
          ),
          warnings.length ? { warnings: Object.freeze(warnings) } : undefined
        );
      }

      if (entry.lifecycleStatus === INTELLIGENCE_USE_CASE_LIFECYCLE.PROHIBITED) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_PROHIBITED,
            "PROHIBITED use case rejected",
            "lookup",
            { useCaseId, version }
          )
        );
      }

      return ok(
        entry,
        warnings.length ? { warnings: Object.freeze(warnings) } : undefined
      );
    },

    /**
     * Deterministic discovery ordered by useCaseId then version.
     * @param {{ lifecycleStatuses?: string[], riskTiers?: string[] }} [filter]
     */
    list(filter = {}) {
      let entries = [...ordered];
      if (Array.isArray(filter.lifecycleStatuses) && filter.lifecycleStatuses.length) {
        const allowed = new Set(filter.lifecycleStatuses);
        entries = entries.filter((e) => allowed.has(e.lifecycleStatus));
      }
      if (Array.isArray(filter.riskTiers) && filter.riskTiers.length) {
        const allowed = new Set(filter.riskTiers);
        entries = entries.filter((e) => allowed.has(e.riskTier));
      }
      entries.sort((a, b) => {
        const idCmp = a.useCaseId.localeCompare(b.useCaseId);
        if (idCmp !== 0) return idCmp;
        return a.version.localeCompare(b.version);
      });
      return ok(Object.freeze(entries.map((e) => e)));
    },

    /**
     * Access-filtered discovery — excludes PROHIBITED and RETIRED by default.
     */
    discoverAccessible() {
      return this.list({
        lifecycleStatuses: [
          INTELLIGENCE_USE_CASE_LIFECYCLE.DRAFT,
          INTELLIGENCE_USE_CASE_LIFECYCLE.ACTIVE,
          INTELLIGENCE_USE_CASE_LIFECYCLE.DEPRECATED,
        ],
      });
    },
  });
}

/**
 * @param {unknown} [input]
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceUseCaseRegistry(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "createIntelligenceUseCaseRegistry input must be a plain object",
        "input"
      )
    );
  }

  const requests = Array.isArray(input.entries) ? input.entries : [];
  /** @type {Map<string, *>} */
  const byIdentity = new Map();
  /** @type {Array<*>} */
  const ordered = [];
  /** @type {Array<*>} */
  const registrations = [];

  for (const request of requests) {
    const defResult = createIntelligenceUseCaseDefinition(request);
    if (!defResult.ok) {
      registrations.push(defResult);
      continue;
    }

    const incoming = defResult.value;
    const key = intelligenceUseCaseIdentityKey(
      incoming.useCaseId,
      incoming.version
    );
    const existing = byIdentity.get(key);

    if (!existing) {
      byIdentity.set(key, incoming);
      ordered.push(incoming);
      registrations.push(
        ok(
          deepFreeze({
            status: INTELLIGENCE_USE_CASE_REGISTRATION_STATUS.REGISTERED,
            entry: incoming,
          })
        )
      );
      continue;
    }

    registrations.push(classifyRegistration(existing, incoming));
  }

  return ok(
    deepFreeze({
      registry: buildReadOnlyRegistry(ordered),
      registrations: Object.freeze([...registrations]),
      size: ordered.length,
    })
  );
}

/**
 * @param {unknown} [input]
 * @returns {import("../contracts/result.js").Result}
 */
export function createReadOnlyIntelligenceUseCaseRegistry(input) {
  const created = createIntelligenceUseCaseRegistry(input);
  if (!created.ok) return created;
  return ok(created.value.registry);
}
