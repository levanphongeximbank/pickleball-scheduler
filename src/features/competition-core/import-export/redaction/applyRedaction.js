/**
 * CORE-22 contract-driven redaction (before checksum).
 * No PII heuristics — only declared paths / omitted modules / reference replacement.
 */

import {
  AUDIT_SECTION_POLICY,
  DEFAULT_REDACTION_PROFILE_ID,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
  createWarning,
} from "../errors.js";
import {
  deepFreezeClone,
  isPlainObject,
  normalizeStringArray,
  compareStableString,
} from "../utils/helpers.js";
import {
  assertNoRedactionReleak,
  createDefaultRedactionProfile,
  createRedactionProfile,
} from "../contracts/redaction.js";

const MASK_TOKEN = "[REDACTED]";

/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
function clonePlain(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(/** @type {object} */ (value))) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      "Cyclic reference during redaction",
      {}
    );
  }
  seen.add(/** @type {object} */ (value));
  if (Array.isArray(value)) {
    return value.map((item) => clonePlain(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      "Non-plain object during redaction",
      {}
    );
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = clonePlain(
      /** @type {Record<string, unknown>} */ (value)[key],
      seen
    );
  }
  return out;
}

/**
 * @param {unknown} root
 * @param {string} path
 * @returns {{ parent: Record<string, unknown>|unknown[]|null, key: string|number|null, value: unknown }}
 */
function resolvePath(root, path) {
  const parts = String(path)
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  let cur = root;
  let parent = null;
  let key = null;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") {
      return { parent: null, key: null, value: undefined };
    }
    parent = cur;
    key = part;
    cur = /** @type {Record<string, unknown>} */ (cur)[part];
  }
  return { parent: /** @type {any} */ (parent), key, value: cur };
}

/**
 * Collect string leaf values under a subtree (for no-releak tracking).
 * @param {unknown} value
 * @param {string[]} out
 */
function collectStringLeaves(value, out) {
  if (typeof value === "string" && value.length > 0) {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return;
  }
  if (isPlainObject(value)) {
    for (const k of Object.keys(value)) {
      collectStringLeaves(
        /** @type {Record<string, unknown>} */ (value)[k],
        out
      );
    }
  }
}

/**
 * Apply redaction profile to module payloads and package-level fields.
 *
 * @param {object} input
 * @param {Record<string, unknown>} input.modules
 * @param {object} [input.redactionProfile]
 * @param {string[]} [input.excludedFieldPaths]
 * @param {string[]} [input.maskedFieldPaths]
 * @param {string[]} [input.omittedModules]
 * @param {Record<string, unknown>} [input.referenceReplacements]
 * @param {unknown[]} [input.auditReferences]
 * @param {unknown} [input.auditPayload] — never exported under PORTABLE_SAFE_V1
 * @returns {Readonly<object>}
 */
export function applyRedaction(input = {}) {
  if (!isPlainObject(input)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      "applyRedaction input must be a plain object",
      {}
    );
  }

  const profile = createRedactionProfile(
    input.redactionProfile == null
      ? createDefaultRedactionProfile()
      : typeof input.redactionProfile === "string"
        ? { profileId: input.redactionProfile }
        : input.redactionProfile
  );

  const excludedFieldPaths = Array.isArray(input.excludedFieldPaths)
    ? [...normalizeStringArray(input.excludedFieldPaths)]
    : [];
  const maskedFieldPaths = Array.isArray(input.maskedFieldPaths)
    ? [...normalizeStringArray(input.maskedFieldPaths)]
    : [];
  const omittedModules = Array.isArray(input.omittedModules)
    ? [...normalizeStringArray(input.omittedModules)]
    : [];

  const modulesIn = isPlainObject(input.modules) ? input.modules : {};
  /** @type {Record<string, unknown>} */
  const modules = /** @type {Record<string, unknown>} */ (
    clonePlain(modulesIn)
  );

  /** @type {string[]} */
  const removedValues = [];
  /** @type {string[]} */
  const removedPaths = [];
  /** @type {object[]} */
  const warnings = [];

  // Omit modules entirely.
  for (const mod of omittedModules) {
    if (mod in modules) {
      collectStringLeaves(modules[mod], removedValues);
      delete modules[mod];
      removedPaths.push(`modules.${mod}`);
      warnings.push(
        createWarning({
          code: "MODULE_OMITTED_BY_REDACTION",
          message: `Module omitted by redaction: ${mod}`,
          fieldPath: `modules.${mod}`,
        })
      );
    }
  }

  // Audit policy: never keep full audit payload; references only or omit.
  if ("audit" in modules) {
    if (profile.auditSectionPolicy === AUDIT_SECTION_POLICY.OMIT) {
      collectStringLeaves(modules.audit, removedValues);
      delete modules.audit;
      removedPaths.push("modules.audit");
      if (!omittedModules.includes("audit")) {
        omittedModules.push("audit");
      }
      warnings.push(
        createWarning({
          code: "AUDIT_SECTION_OMITTED",
          message: "Audit module omitted by auditSectionPolicy=OMIT",
          fieldPath: "modules.audit",
        })
      );
    } else {
      // REFERENCES_ONLY — replace payload with references-only shell.
      // Idempotent: already-safe audit payloads keep stable warnings/removedPaths.
      const existing = modules.audit;
      /** @type {unknown[]} */
      let refs = [];
      if (isPlainObject(existing) && Array.isArray(existing.references)) {
        refs = existing.references.map((r) => clonePlain(r));
      } else if (Array.isArray(input.auditReferences)) {
        refs = input.auditReferences.map((r) => clonePlain(r));
      }

      if (isPlainObject(existing) && existing.events != null) {
        collectStringLeaves(existing.events, removedValues);
      }
      if (input.auditPayload != null) {
        collectStringLeaves(input.auditPayload, removedValues);
      }

      // Stable redaction declaration (checksum-relevant, idempotent).
      removedPaths.push("modules.audit.events");
      warnings.push(
        createWarning({
          code: "AUDIT_REFERENCES_ONLY",
          message: "Audit section reduced to references only",
          fieldPath: "modules.audit",
        })
      );

      modules.audit = {
        policy: AUDIT_SECTION_POLICY.REFERENCES_ONLY,
        references: refs,
      };
    }
  }

  // Exclude field paths (delete).
  for (const fieldPath of excludedFieldPaths) {
    const resolved = resolvePath({ modules }, fieldPath.startsWith("modules.")
      ? fieldPath
      : `modules.${fieldPath}`);
    if (resolved.parent != null && resolved.key != null) {
      collectStringLeaves(resolved.value, removedValues);
      if (Array.isArray(resolved.parent) && typeof resolved.key === "number") {
        resolved.parent.splice(resolved.key, 1);
      } else if (isPlainObject(resolved.parent)) {
        delete /** @type {Record<string, unknown>} */ (resolved.parent)[
          String(resolved.key)
        ];
      }
      removedPaths.push(fieldPath);
      warnings.push(
        createWarning({
          code: "FIELD_EXCLUDED_BY_REDACTION",
          message: `Field excluded by redaction: ${fieldPath}`,
          fieldPath,
        })
      );
    }
  }

  // Mask field paths.
  for (const fieldPath of maskedFieldPaths) {
    const full = fieldPath.startsWith("modules.")
      ? fieldPath
      : `modules.${fieldPath}`;
    const resolved = resolvePath({ modules }, full);
    if (resolved.parent != null && resolved.key != null) {
      collectStringLeaves(resolved.value, removedValues);
      if (isPlainObject(resolved.parent) || Array.isArray(resolved.parent)) {
        /** @type {any} */ (resolved.parent)[resolved.key] = MASK_TOKEN;
      }
      removedPaths.push(fieldPath);
      warnings.push(
        createWarning({
          code: "FIELD_MASKED_BY_REDACTION",
          message: `Field masked by redaction: ${fieldPath}`,
          fieldPath,
        })
      );
    }
  }

  // Declared reference replacements (deterministic).
  if (isPlainObject(input.referenceReplacements)) {
    for (const key of Object.keys(input.referenceReplacements).sort(
      compareStableString
    )) {
      const full = key.startsWith("modules.") ? key : `modules.${key}`;
      const resolved = resolvePath({ modules }, full);
      if (resolved.parent != null && resolved.key != null) {
        collectStringLeaves(resolved.value, removedValues);
        /** @type {any} */ (resolved.parent)[resolved.key] =
          clonePlain(input.referenceReplacements[key]);
        removedPaths.push(key);
      }
    }
  }

  // Unique removed values (sorted) — used for no-releak checks; values themselves
  // must not appear in warnings/errors/conflicts.
  const uniqueRemoved = [
    ...new Set(removedValues.filter((v) => typeof v === "string" && v.length > 0)),
  ].sort(compareStableString);

  const warningPayload = warnings.map((w) => ({
    code: w.code,
    message: w.message,
    fieldPath: w.fieldPath,
  }));
  assertNoRedactionReleak(warningPayload, uniqueRemoved, "warnings");

  const enrichedProfile = createRedactionProfile({
    ...profile,
    profileId: profile.profileId ?? DEFAULT_REDACTION_PROFILE_ID,
    removedPaths: [
      ...new Set([...(profile.removedPaths ?? []), ...removedPaths]),
    ].sort(compareStableString),
  });

  return Object.freeze(
    deepFreezeClone({
      modules,
      redactionProfile: enrichedProfile,
      omittedModules: [...new Set(omittedModules)].sort(compareStableString),
      removedPaths: [...new Set(removedPaths)].sort(compareStableString),
      removedValues: Object.freeze(uniqueRemoved),
      warnings: Object.freeze(warnings),
      maskToken: MASK_TOKEN,
    })
  );
}

export { MASK_TOKEN };
