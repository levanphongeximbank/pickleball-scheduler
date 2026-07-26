/**
 * ECO-01→04 certification matrix + structural readiness projection (ECO-05).
 * structuralFoundationComplete is true only when every required gate PASSes
 * and production-activation invariants remain fail-closed.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CERTIFICATION_GATE_STATUS,
  CERTIFICATION_MATRIX_VERSION,
  ECOSYSTEM_INTEGRATIONS_PHASE,
  STRUCTURAL_READINESS_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";

export const CERTIFICATION_MATRIX_ERROR = Object.freeze({
  INVALID: "CERTIFICATION_MATRIX_INVALID",
  VERSION_INVALID: "CERTIFICATION_MATRIX_VERSION_INVALID",
  GATE_INVALID: "CERTIFICATION_MATRIX_GATE_INVALID",
  FLAG_INVALID: "CERTIFICATION_MATRIX_FLAG_INVALID",
});

export const STRUCTURAL_READINESS_ERROR = Object.freeze({
  INVALID: "STRUCTURAL_READINESS_INVALID",
  VERSION_INVALID: "STRUCTURAL_READINESS_VERSION_INVALID",
  MATRIX_INVALID: "STRUCTURAL_READINESS_MATRIX_INVALID",
  FLAG_INVALID: "STRUCTURAL_READINESS_FLAG_INVALID",
});

/**
 * @param {boolean} pass
 * @param {string} [blockedReason]
 */
function gate(pass, blockedReason) {
  if (pass) {
    return Object.freeze({
      status: CERTIFICATION_GATE_STATUS.PASS,
    });
  }
  return Object.freeze({
    status: CERTIFICATION_GATE_STATUS.FAIL,
    ...(blockedReason ? { blockedReason } : {}),
  });
}

/**
 * Build the ECO-01→04 structural certification matrix from injected evidence.
 * Defaults align with in-repo structural foundation (no live activation).
 * @param {*} [input]
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectCertificationMatrix(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        CERTIFICATION_MATRIX_ERROR.INVALID,
        "Certification matrix input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? CERTIFICATION_MATRIX_VERSION,
    "contractVersion",
    CERTIFICATION_MATRIX_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const projectedAt = requireIsoInstant(
    input.projectedAt ?? new Date().toISOString(),
    "projectedAt",
    CERTIFICATION_MATRIX_ERROR.INVALID
  );
  if (!projectedAt.ok) return projectedAt;

  /** @type {Record<string, boolean>} */
  const flags = {
    eco01Present: input.eco01Present ?? true,
    eco02Present: input.eco02Present ?? true,
    eco02bPresent: input.eco02bPresent ?? true,
    eco03Present: input.eco03Present ?? true,
    eco04Present: input.eco04Present ?? true,
    connectorCompatible: input.connectorCompatible ?? true,
    secretBoundaryCompatible: input.secretBoundaryCompatible ?? true,
    adapterFoundationCompatible: input.adapterFoundationCompatible ?? true,
    webhookIngressCompatible: input.webhookIngressCompatible ?? true,
    observabilityProviderNeutral: input.observabilityProviderNeutral ?? true,
    diagnosticsRedacted: input.diagnosticsRedacted ?? true,
    noEnvAccess: input.noEnvAccess ?? true,
    noNetworkClients: input.noNetworkClients ?? true,
    noVendorSdk: input.noVendorSdk ?? true,
    noLiveResolver: input.noLiveResolver ?? true,
    hasRealProviders: input.hasRealProviders ?? false,
    hasLiveCredentialResolver: input.hasLiveCredentialResolver ?? false,
    hasProductionWebhooks: input.hasProductionWebhooks ?? false,
    hasNetworkClients: input.hasNetworkClients ?? false,
    productionBlocked: input.productionBlocked ?? true,
  };

  for (const [key, value] of Object.entries(flags)) {
    if (typeof value !== "boolean") {
      return fail(
        contractError(
          CERTIFICATION_MATRIX_ERROR.FLAG_INVALID,
          `${key} must be a boolean`,
          key
        )
      );
    }
  }

  const gates = Object.freeze({
    ECO_01_PRESENT: gate(flags.eco01Present, "eco01_absent"),
    ECO_02_PRESENT: gate(flags.eco02Present, "eco02_absent"),
    ECO_02B_PRESENT: gate(flags.eco02bPresent, "eco02b_absent"),
    ECO_03_PRESENT: gate(flags.eco03Present, "eco03_absent"),
    ECO_04_PRESENT: gate(flags.eco04Present, "eco04_absent"),
    CONNECTOR_COMPATIBLE: gate(
      flags.connectorCompatible,
      "connector_incompatible"
    ),
    SECRET_BOUNDARY_COMPATIBLE: gate(
      flags.secretBoundaryCompatible,
      "secret_boundary_incompatible"
    ),
    ADAPTER_FOUNDATION_COMPATIBLE: gate(
      flags.adapterFoundationCompatible,
      "adapter_foundation_incompatible"
    ),
    WEBHOOK_INGRESS_COMPATIBLE: gate(
      flags.webhookIngressCompatible,
      "webhook_ingress_incompatible"
    ),
    OBSERVABILITY_PROVIDER_NEUTRAL: gate(
      flags.observabilityProviderNeutral,
      "observability_not_provider_neutral"
    ),
    DIAGNOSTICS_REDACTED: gate(
      flags.diagnosticsRedacted,
      "diagnostics_not_redacted"
    ),
    NO_ENV_ACCESS: gate(flags.noEnvAccess, "env_access_detected"),
    NO_NETWORK_CLIENTS: gate(
      flags.noNetworkClients && !flags.hasNetworkClients,
      "network_clients_detected"
    ),
    NO_VENDOR_SDK: gate(flags.noVendorSdk, "vendor_sdk_detected"),
    NO_LIVE_RESOLVER: gate(
      flags.noLiveResolver && !flags.hasLiveCredentialResolver,
      "live_credential_resolver_detected"
    ),
    HAS_REAL_PROVIDERS_FALSE: gate(
      flags.hasRealProviders === false,
      "has_real_providers_true"
    ),
    HAS_LIVE_CREDENTIAL_RESOLVER_FALSE: gate(
      flags.hasLiveCredentialResolver === false,
      "has_live_credential_resolver_true"
    ),
    HAS_PRODUCTION_WEBHOOKS_FALSE: gate(
      flags.hasProductionWebhooks === false,
      "has_production_webhooks_true"
    ),
    PRODUCTION_BLOCKED_TRUE: gate(
      flags.productionBlocked === true,
      "production_not_blocked"
    ),
  });

  /** @type {string[]} */
  const failedGates = [];
  for (const [name, result] of Object.entries(gates)) {
    if (result.status !== CERTIFICATION_GATE_STATUS.PASS) {
      failedGates.push(name);
    }
  }

  const allPassed = failedGates.length === 0;

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      projectedAt: projectedAt.value,
      phaseId: ECOSYSTEM_INTEGRATIONS_PHASE.id,
      gates,
      failedGates: Object.freeze(failedGates),
      allPassed,
      invariants: Object.freeze({
        hasRealProviders: flags.hasRealProviders,
        hasLiveCredentialResolver: flags.hasLiveCredentialResolver,
        hasProductionWebhooks: flags.hasProductionWebhooks,
        hasNetworkClients: flags.hasNetworkClients,
        productionBlocked: flags.productionBlocked,
      }),
    })
  );
}

/**
 * Final structural readiness projection.
 * structuralFoundationComplete === true only when matrix.allPassed.
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectStructuralFoundationReadiness(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        STRUCTURAL_READINESS_ERROR.INVALID,
        "Structural readiness input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? STRUCTURAL_READINESS_VERSION,
    "contractVersion",
    STRUCTURAL_READINESS_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const projectedAt = requireIsoInstant(
    input.projectedAt ?? new Date().toISOString(),
    "projectedAt",
    STRUCTURAL_READINESS_ERROR.INVALID
  );
  if (!projectedAt.ok) return projectedAt;

  let matrix;
  if ("certificationMatrix" in input && input.certificationMatrix !== undefined) {
    if (!isPlainObject(input.certificationMatrix)) {
      return fail(
        contractError(
          STRUCTURAL_READINESS_ERROR.MATRIX_INVALID,
          "certificationMatrix must be a plain object",
          "certificationMatrix"
        )
      );
    }
    matrix = input.certificationMatrix;
    if (typeof matrix.allPassed !== "boolean" || !isPlainObject(matrix.gates)) {
      return fail(
        contractError(
          STRUCTURAL_READINESS_ERROR.MATRIX_INVALID,
          "certificationMatrix must include allPassed and gates",
          "certificationMatrix"
        )
      );
    }
  } else {
    const built = projectCertificationMatrix(input.matrixInput ?? {});
    if (!built.ok) return built;
    matrix = built.value;
  }

  const observabilityReady = requireBoolean(
    input.observabilityReady ?? true,
    "observabilityReady",
    STRUCTURAL_READINESS_ERROR.FLAG_INVALID
  );
  if (!observabilityReady.ok) return observabilityReady;

  const aggregateHealthCompatible = requireBoolean(
    input.aggregateHealthCompatible ?? true,
    "aggregateHealthCompatible",
    STRUCTURAL_READINESS_ERROR.FLAG_INVALID
  );
  if (!aggregateHealthCompatible.ok) return aggregateHealthCompatible;

  const productionBlocked = requireBoolean(
    input.productionBlocked ??
      matrix.invariants?.productionBlocked ??
      ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked,
    "productionBlocked",
    STRUCTURAL_READINESS_ERROR.FLAG_INVALID
  );
  if (!productionBlocked.ok) return productionBlocked;

  const hasRealProviders = requireBoolean(
    input.hasRealProviders ??
      matrix.invariants?.hasRealProviders ??
      ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders,
    "hasRealProviders",
    STRUCTURAL_READINESS_ERROR.FLAG_INVALID
  );
  if (!hasRealProviders.ok) return hasRealProviders;

  const hasLiveCredentialResolver = requireBoolean(
    input.hasLiveCredentialResolver ??
      matrix.invariants?.hasLiveCredentialResolver ??
      ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver,
    "hasLiveCredentialResolver",
    STRUCTURAL_READINESS_ERROR.FLAG_INVALID
  );
  if (!hasLiveCredentialResolver.ok) return hasLiveCredentialResolver;

  const hasProductionWebhooks = requireBoolean(
    input.hasProductionWebhooks ??
      matrix.invariants?.hasProductionWebhooks ??
      ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks,
    "hasProductionWebhooks",
    STRUCTURAL_READINESS_ERROR.FLAG_INVALID
  );
  if (!hasProductionWebhooks.ok) return hasProductionWebhooks;

  /** @type {string[]} */
  const blockers = [];
  if (!matrix.allPassed) {
    blockers.push("certification_matrix_incomplete");
  }
  if (!observabilityReady.value) {
    blockers.push("observability_not_ready");
  }
  if (!aggregateHealthCompatible.value) {
    blockers.push("aggregate_health_incompatible");
  }
  if (!productionBlocked.value) {
    blockers.push("production_not_blocked");
  }
  if (hasRealProviders.value) {
    blockers.push("has_real_providers");
  }
  if (hasLiveCredentialResolver.value) {
    blockers.push("has_live_credential_resolver");
  }
  if (hasProductionWebhooks.value) {
    blockers.push("has_production_webhooks");
  }

  const structuralFoundationComplete = blockers.length === 0;

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      projectedAt: projectedAt.value,
      phaseId: ECOSYSTEM_INTEGRATIONS_PHASE.id,
      structuralFoundationComplete,
      productionBlocked: productionBlocked.value,
      hasRealProviders: hasRealProviders.value,
      hasLiveCredentialResolver: hasLiveCredentialResolver.value,
      hasProductionWebhooks: hasProductionWebhooks.value,
      observabilityReady: observabilityReady.value,
      aggregateHealthCompatible: aggregateHealthCompatible.value,
      certificationAllPassed: matrix.allPassed === true,
      blockers: Object.freeze(blockers),
      certificationMatrix: matrix,
    })
  );
}
