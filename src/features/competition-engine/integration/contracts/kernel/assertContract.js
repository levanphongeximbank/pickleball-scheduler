/**
 * Shared assertion + frozen adapter view for Canonical Competition Adapter Contracts.
 */

import {
  CAPABILITY_KIND,
  CAPABILITY_KIND_VALUES,
  COMPETITION_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
  SHARED_ADAPTER_ERROR_CODE,
  SHARED_FORBIDDEN_METHODS,
} from "./constants.js";
import { failCompetitionAdapter } from "./errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "./helpers.js";

/**
 * @param {unknown} definition
 */
export function assertContractDefinition(definition) {
  if (!isPlainObject(definition)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Contract definition must be a plain object",
      {}
    );
  }
  const requiredMeta = [
    "contractId",
    "contractVersion",
    "locked",
    "domain",
    "authorityOwner",
    "direction",
    "capabilities",
    "requiredContext",
    "requiredMethods",
    "forbiddenMethods",
    "forbiddenAuthorityKeys",
    "errorCodes",
    "runtimeClassification",
  ];
  for (const key of requiredMeta) {
    if (definition[key] == null) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
        `Contract definition missing ${key}`,
        { key }
      );
    }
  }
  if (!isNonEmptyString(definition.contractId)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "contractId is required",
      {}
    );
  }
  if (definition.contractVersion !== COMPETITION_ADAPTER_CONTRACT_VERSION_V1) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION,
      "Owned contract version must be 1.0.0",
      { contractVersion: definition.contractVersion }
    );
  }
  if (definition.locked !== COMPETITION_ADAPTER_CONTRACT_LOCKED) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Contract must be locked=true",
      { locked: definition.locked }
    );
  }
  if (!Array.isArray(definition.capabilities) || definition.capabilities.length === 0) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "capabilities must be a non-empty array",
      {}
    );
  }
  for (const capability of definition.capabilities) {
    if (!isPlainObject(capability) || !isNonEmptyString(capability.name)) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
        "Each capability must have a name",
        {}
      );
    }
    if (!CAPABILITY_KIND_VALUES.includes(capability.kind)) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
        "Each capability must be QUERY, COMMAND, or EVENT",
        { name: capability.name, kind: capability.kind }
      );
    }
  }
  return definition;
}

/**
 * @param {object} adapter
 * @param {object} definition
 */
export function assertCanonicalAdapterDoesNotOwnAuthority(adapter, definition) {
  const forbiddenMethods = [
    ...SHARED_FORBIDDEN_METHODS,
    ...((definition && definition.forbiddenMethods) || []),
  ];
  for (const method of forbiddenMethods) {
    if (typeof adapter[method] === "function") {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY,
        `Adapter must not own forbidden method: ${method}`,
        { method }
      );
    }
  }
  const forbiddenKeys = [
    ...FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
    ...((definition && definition.forbiddenAuthorityKeys) || []),
  ];
  for (const key of forbiddenKeys) {
    if (adapter[key] != null) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY,
        `Adapter must not expose authority key: ${key}`,
        { key }
      );
    }
  }
}

/**
 * @param {unknown} adapter
 * @param {object} definition
 */
export function assertCompetitionAdapter(adapter, definition) {
  const def = assertContractDefinition(definition);
  if (!isPlainObject(adapter)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Adapter must be a plain object",
      {}
    );
  }
  if (!isNonEmptyString(adapter.contractId) || !isNonEmptyString(adapter.contractVersion)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "contractId and contractVersion are required",
      {}
    );
  }
  if (adapter.contractId !== def.contractId) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.UNKNOWN_CONTRACT,
      "Adapter contractId does not match definition",
      { contractId: adapter.contractId, expected: def.contractId }
    );
  }
  if (adapter.contractVersion !== def.contractVersion) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION,
      "Adapter contractVersion must be 1.0.0",
      { contractVersion: adapter.contractVersion }
    );
  }
  if (adapter.locked !== true) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Adapter locked must be true",
      { locked: adapter.locked }
    );
  }
  for (const method of def.requiredMethods) {
    if (typeof adapter[method] !== "function") {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
        `Adapter missing required method: ${method}`,
        { method }
      );
    }
  }
  assertCanonicalAdapterDoesNotOwnAuthority(adapter, def);
  return adapter;
}

function notConfiguredHandler(definition, method) {
  return function notConfigured() {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
      `${definition.contractId} capability ${method} is not configured`,
      { contractId: definition.contractId, method }
    );
  };
}

function unsupportedHandler(definition, method) {
  return function capabilityNotSupported() {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.CAPABILITY_NOT_SUPPORTED,
      `${definition.contractId} does not support ${method}`,
      { contractId: definition.contractId, method }
    );
  };
}

/**
 * Wrap a validated adapter so metadata is immutable and authority cannot be added later.
 *
 * @param {object} adapter
 * @param {object} definition
 */
export function freezeAdapterView(adapter, definition) {
  const def = assertContractDefinition(definition);
  const validated = assertCompetitionAdapter(adapter, def);
  const view = {
    contractId: def.contractId,
    contractVersion: def.contractVersion,
    locked: true,
    domain: def.domain,
    authorityOwner: def.authorityOwner,
    direction: def.direction,
    capabilities: freezeClone(def.capabilities),
    requiredContext: freezeClone(def.requiredContext),
    requiredMethods: freezeClone(def.requiredMethods),
    forbiddenMethods: freezeClone(def.forbiddenMethods),
    forbiddenAuthorityKeys: freezeClone(def.forbiddenAuthorityKeys),
    errorCodes: freezeClone(def.errorCodes),
    runtimeClassification: def.runtimeClassification,
    productionBinding: validated.productionBinding || def.productionBinding || null,
    ownsAuthority: false,
  };
  for (const method of def.requiredMethods) {
    const impl = validated[method];
    view[method] = (...args) => {
      const result = impl(...args);
      if (result && typeof result === "object" && typeof result.then === "function") {
        return result.then((value) =>
          value && typeof value === "object" ? freezeClone(value) : value
        );
      }
      return result && typeof result === "object" ? freezeClone(result) : result;
    };
  }
  return Object.freeze(view);
}

/**
 * @param {object} definition
 * @param {{
 *   handlers?: Record<string, Function>,
 *   productionBinding?: string,
 *   runtimeClassification?: string,
 *   notConfiguredMethods?: string[],
 * }} [options]
 */
export function createContractAdapter(definition, options = {}) {
  const def = assertContractDefinition(definition);
  const handlers = isPlainObject(options.handlers) ? options.handlers : {};
  const notConfigured = new Set(options.notConfiguredMethods || []);
  const adapter = {
    contractId: def.contractId,
    contractVersion: def.contractVersion,
    locked: true,
    domain: def.domain,
    productionBinding:
      options.productionBinding || def.productionBinding || null,
    runtimeClassification:
      options.runtimeClassification || def.runtimeClassification,
  };
  for (const method of def.requiredMethods) {
    if (typeof handlers[method] === "function") {
      adapter[method] = handlers[method];
    } else if (notConfigured.has(method) || !handlers[method]) {
      adapter[method] = notConfiguredHandler(def, method);
    } else {
      adapter[method] = unsupportedHandler(def, method);
    }
  }
  return freezeAdapterView(adapter, def);
}

export { CAPABILITY_KIND };
