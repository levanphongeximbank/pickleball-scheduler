import {
  CANONICAL_IDENTITY_CONTRACT_VERSION,
  LEGACY_COURT_MAPPING_STATUS,
} from "../constants/canonicalIdentity.js";
import { isCanonicalPhysicalCourtId } from "./canonicalPhysicalCourt.js";

const KEY_FIELDS = Object.freeze([
  "tenantId",
  "clubId",
  "sourceSystem",
  "sourceVersion",
  "legacyClusterId",
  "legacyCourtId",
]);

function requiredText(value, field) {
  const normalized = value == null ? "" : String(value).trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (value && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreeze(item)]))
    );
  }
  return value;
}

export function normalizeLegacyCourtIdentityMapping(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Legacy court identity mapping must be an object.");
  }
  const classification = String(input.classification ?? "").trim().toLowerCase();
  if (!Object.values(LEGACY_COURT_MAPPING_STATUS).includes(classification)) {
    throw new TypeError("classification is unsupported.");
  }
  const physicalCourtId =
    input.physicalCourtId == null || String(input.physicalCourtId).trim() === ""
      ? null
      : String(input.physicalCourtId).trim();
  if (physicalCourtId && !isCanonicalPhysicalCourtId(physicalCourtId)) {
    throw new TypeError("physicalCourtId must be a UUID.");
  }
  if (classification === "deterministic" && !physicalCourtId) {
    throw new TypeError("deterministic mapping requires physicalCourtId.");
  }
  if (classification !== "deterministic" && physicalCourtId) {
    throw new TypeError("Only deterministic mapping may carry physicalCourtId.");
  }
  const version = Number(input.version ?? 1);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError("version must be a positive integer.");
  }
  if (!Array.isArray(input.evidence ?? [])) {
    throw new TypeError("evidence must be an array.");
  }
  if (
    !input.sourceContext ||
    typeof input.sourceContext !== "object" ||
    Array.isArray(input.sourceContext)
  ) {
    if (input.sourceContext != null) {
      throw new TypeError("sourceContext must be an object.");
    }
  }
  return Object.freeze({
    contractVersion: requiredText(
      input.contractVersion ?? CANONICAL_IDENTITY_CONTRACT_VERSION,
      "contractVersion"
    ),
    version,
    tenantId: requiredText(input.tenantId, "tenantId"),
    clubId: requiredText(input.clubId, "clubId"),
    sourceSystem: requiredText(input.sourceSystem, "sourceSystem"),
    sourceVersion: requiredText(input.sourceVersion, "sourceVersion"),
    legacyClusterId: requiredText(input.legacyClusterId, "legacyClusterId"),
    legacyCourtId: requiredText(input.legacyCourtId, "legacyCourtId"),
    physicalCourtId,
    classification,
    sourceContext: deepFreeze(input.sourceContext ?? {}),
    evidence: deepFreeze(input.evidence ?? []),
  });
}

export const createLegacyCourtIdentityMapping = normalizeLegacyCourtIdentityMapping;

function sameKey(left, right) {
  return KEY_FIELDS.every((field) => left[field] === right[field]);
}

export function resolveLegacyCourtIdentity(request = {}, mappings = []) {
  let key;
  try {
    key = Object.fromEntries(KEY_FIELDS.map((field) => [field, requiredText(request[field], field)]));
  } catch {
    return Object.freeze({ ok: false, classification: "invalid_scope", physicalCourtId: null });
  }
  if (!Array.isArray(mappings)) {
    return Object.freeze({ ok: false, classification: "invalid_scope", physicalCourtId: null });
  }

  const rawEnvelope = mappings.filter(
    (mapping) =>
      String(mapping?.clubId ?? "").trim() === key.clubId &&
      String(mapping?.sourceSystem ?? "").trim() === key.sourceSystem &&
      String(mapping?.sourceVersion ?? "").trim() === key.sourceVersion &&
      String(mapping?.legacyClusterId ?? "").trim() === key.legacyClusterId &&
      String(mapping?.legacyCourtId ?? "").trim() === key.legacyCourtId
  );
  const valid = rawEnvelope.flatMap((value) => {
    try {
      return [normalizeLegacyCourtIdentityMapping(value)];
    } catch {
      return [];
    }
  });
  if (valid.length !== rawEnvelope.length) {
    return Object.freeze({
      ok: false,
      classification: "invalid_scope",
      physicalCourtId: null,
      reason: "INVALID_MAPPING_RECORD",
    });
  }
  const sourceEnvelope = valid;
  if (sourceEnvelope.some((mapping) => mapping.tenantId !== key.tenantId)) {
    return Object.freeze({
      ok: false,
      classification: "invalid_scope",
      physicalCourtId: null,
      reason: "CROSS_TENANT_MAPPING",
    });
  }
  const scoped = sourceEnvelope.filter((mapping) => sameKey(mapping, key));
  if (scoped.length === 0) {
    return Object.freeze({
      ok: false,
      classification: "candidate_review",
      physicalCourtId: null,
      reason: "MAPPING_NOT_FOUND",
    });
  }
  const signatures = new Set(
    scoped.map((mapping) => `${mapping.classification}:${mapping.physicalCourtId ?? ""}`)
  );
  if (signatures.size !== 1) {
    return Object.freeze({
      ok: false,
      classification: "ambiguous",
      physicalCourtId: null,
      reason: "CONFLICTING_MAPPINGS",
    });
  }
  const mapping = scoped[0];
  if (mapping.classification !== "deterministic") {
    return Object.freeze({
      ok: false,
      classification: mapping.classification,
      physicalCourtId: null,
      reason: "MAPPING_NOT_DETERMINISTIC",
    });
  }
  return Object.freeze({
    ok: true,
    classification: "deterministic",
    physicalCourtId: mapping.physicalCourtId,
    mappings: Object.freeze(scoped),
  });
}

export { KEY_FIELDS as LEGACY_COURT_MAPPING_KEY_FIELDS };
