/**
 * CORE-22 compatibility evaluation.
 */

import {
  COMPATIBILITY_STATUS,
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  MANIFEST_VERSION,
} from "../constants.js";
import { createCompatibilityResult } from "../contracts/compatibility.js";
import { isPlainObject, compareStableString } from "../utils/helpers.js";
import { createDefaultAdapterRegistry } from "../adapters/index.js";

/**
 * @param {object} input
 * @param {object} input.package
 * @param {object} [input.adapterRegistry]
 * @param {Record<string, string>} [input.targetCapabilities] — algorithm/rule capability map
 * @param {string[]} [input.mandatoryModules]
 * @returns {Readonly<object>}
 */
export function evaluateCompatibility(input = {}) {
  const pkg = input.package;
  if (!isPlainObject(pkg) || !isPlainObject(pkg.manifest)) {
    return createCompatibilityResult({
      status: COMPATIBILITY_STATUS.INCOMPATIBLE,
      applyEligible: false,
      reasons: ["Package or manifest missing"],
    });
  }

  const registry = input.adapterRegistry ?? createDefaultAdapterRegistry();
  /** @type {string[]} */
  const reasons = [];
  /** @type {object[]} */
  const warnings = [];
  /** @type {string[]} */
  const requiredAdapters = [];
  /** @type {string[]} */
  const unsupportedModules = [];

  // Manifest / schema gates.
  if (pkg.manifest.manifestVersion !== MANIFEST_VERSION) {
    return createCompatibilityResult({
      status: COMPATIBILITY_STATUS.UNSUPPORTED_VERSION,
      applyEligible: false,
      reasons: [
        `Unsupported manifestVersion ${pkg.manifest.manifestVersion}`,
      ],
      unsupportedModules: [],
      requiredAdapters: [],
    });
  }
  if (pkg.schemaVersion !== COMPETITION_PACKAGE_SCHEMA_VERSION) {
    return createCompatibilityResult({
      status: COMPATIBILITY_STATUS.UNSUPPORTED_VERSION,
      applyEligible: false,
      reasons: [`Unsupported schemaVersion ${pkg.schemaVersion}`],
      requiredAdapters: ["core22.schema-adapter"],
    });
  }

  const included = [...(pkg.manifest.includedModules ?? [])];
  const mandatory = Array.isArray(input.mandatoryModules)
    ? input.mandatoryModules
    : [];

  for (const mod of mandatory) {
    if (!included.includes(mod)) {
      reasons.push(`Missing mandatory module dependency: ${mod}`);
    }
  }
  if (reasons.some((r) => r.startsWith("Missing mandatory"))) {
    return createCompatibilityResult({
      status: COMPATIBILITY_STATUS.MISSING_DEPENDENCY,
      applyEligible: false,
      reasons,
    });
  }

  let requiresAdapter = false;
  let partiallyCompatible = false;
  let incompatible = false;

  for (const mod of included.sort(compareStableString)) {
    const adapter = registry.resolve(mod);
    const moduleVersion = pkg.manifest.moduleVersions?.[mod] ?? "1.0.0";

    if (!adapter) {
      unsupportedModules.push(mod);
      requiredAdapters.push(`missing-adapter.${mod}`);
      requiresAdapter = true;
      reasons.push(`No adapter registered for module ${mod}`);
      continue;
    }

    const payload = pkg.modules?.[mod];
    let adapterResult = {
      status: COMPATIBILITY_STATUS.COMPATIBLE,
      requiredAdapters: [],
    };
    if (typeof adapter.evaluateCompatibility === "function") {
      adapterResult = adapter.evaluateCompatibility(payload, {
        moduleVersion,
        package: pkg,
      });
    } else if (adapter.requiresDomainAdapter) {
      adapterResult = {
        status: COMPATIBILITY_STATUS.REQUIRES_ADAPTER,
        requiredAdapters: [`${adapter.coreId}.${mod}`],
      };
    } else if (
      Array.isArray(adapter.supportedVersions) &&
      !adapter.supportedVersions.includes(String(moduleVersion))
    ) {
      adapterResult = {
        status: COMPATIBILITY_STATUS.REQUIRES_ADAPTER,
        requiredAdapters: [`${mod}.version-adapter`],
      };
    }

    if (adapterResult.status === COMPATIBILITY_STATUS.REQUIRES_ADAPTER) {
      requiresAdapter = true;
      requiredAdapters.push(...(adapterResult.requiredAdapters ?? []));
      reasons.push(`Module ${mod} requires adapter`);
    } else if (adapterResult.status === COMPATIBILITY_STATUS.INCOMPATIBLE) {
      incompatible = true;
      unsupportedModules.push(mod);
      reasons.push(`Module ${mod} incompatible`);
    } else if (
      adapterResult.status === COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE
    ) {
      partiallyCompatible = true;
      reasons.push(`Module ${mod} partially compatible`);
    }

    if (typeof adapter.validatePayload === "function") {
      const v = adapter.validatePayload(payload, { moduleVersion });
      if (v && v.ok === false) {
        incompatible = true;
        reasons.push(
          `Module ${mod} payload invalid: ${(v.errors ?? [])
            .map((e) => e.message)
            .join("; ")}`
        );
      }
    }
  }

  // Algorithm / rule-set capability checks.
  const targetCapabilities = isPlainObject(input.targetCapabilities)
    ? input.targetCapabilities
    : {};
  const ruleSets = isPlainObject(pkg.manifest.ruleSetVersions)
    ? pkg.manifest.ruleSetVersions
    : {};
  for (const [ruleId, version] of Object.entries(ruleSets)) {
    const capabilityKey = `ruleset:${ruleId}`;
    if (
      targetCapabilities[capabilityKey] != null &&
      targetCapabilities[capabilityKey] !== version
    ) {
      incompatible = true;
      reasons.push(`Rule-set capability mismatch for ${ruleId}`);
    }
  }
  const algorithms = isPlainObject(pkg.manifest.algorithmVersions)
    ? pkg.manifest.algorithmVersions
    : {};
  for (const [algId, version] of Object.entries(algorithms)) {
    const capabilityKey = `algorithm:${algId}`;
    if (
      targetCapabilities[capabilityKey] != null &&
      targetCapabilities[capabilityKey] !== version
    ) {
      incompatible = true;
      reasons.push(`Algorithm capability mismatch for ${algId}`);
    }
  }

  // Unknown optional metadata → warning (compatible with warnings).
  if (
    isPlainObject(pkg.manifest.metadata) &&
    Object.keys(pkg.manifest.metadata).length > 0
  ) {
    const known = new Set([
      "label",
      "notes",
      "exportLabel",
      "deterministicTag",
    ]);
    for (const key of Object.keys(pkg.manifest.metadata)) {
      if (!known.has(key)) {
        warnings.push({
          code: "UNKNOWN_OPTIONAL_METADATA",
          message: `Unknown optional metadata key: ${key}`,
        });
      }
    }
  }

  let status = COMPATIBILITY_STATUS.COMPATIBLE;
  if (incompatible) {
    status = COMPATIBILITY_STATUS.INCOMPATIBLE;
  } else if (requiresAdapter && partiallyCompatible) {
    status = COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE;
  } else if (requiresAdapter) {
    status = COMPATIBILITY_STATUS.REQUIRES_ADAPTER;
  } else if (partiallyCompatible) {
    status = COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE;
  } else if (warnings.length > 0) {
    status = COMPATIBILITY_STATUS.COMPATIBLE_WITH_WARNINGS;
  }

  // Unique adapters
  const uniqueAdapters = [...new Set(requiredAdapters)].sort(
    compareStableString
  );

  return createCompatibilityResult({
    status,
    applyEligible:
      status === COMPATIBILITY_STATUS.COMPATIBLE ||
      status === COMPATIBILITY_STATUS.COMPATIBLE_WITH_WARNINGS,
    reasons,
    warnings,
    requiredAdapters: uniqueAdapters,
    unsupportedModules: [...new Set(unsupportedModules)].sort(
      compareStableString
    ),
  });
}
