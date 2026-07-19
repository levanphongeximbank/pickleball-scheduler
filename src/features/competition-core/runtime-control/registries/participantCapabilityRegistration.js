/**
 * Phase 3B Integrator Wave 1 — explicit Participant capability registration.
 *
 * Descriptor-only. Does NOT invoke ParticipantResolver, enable Shadow,
 * change RUNTIME_EXECUTOR, or wire Production callers.
 * Must be called explicitly — no import-time side effects.
 */

import { RUNTIME_CAPABILITY, RUNTIME_EXECUTOR } from "../constants/runtimeScopes.js";
import { REGISTRY_REASON_CODE } from "./registryReasonCodes.js";
import {
  registerCapabilityExecutor,
  resolveCapabilityExecutor,
  getCapabilityExecutorRegistration,
} from "./capabilityExecutors.js";
import {
  registerShadowComparator,
  getShadowComparatorRegistration,
} from "../shadow/registries/comparators.js";
import {
  registerShadowNormalizer,
  getShadowNormalizerRegistration,
} from "../shadow/registries/normalizers.js";
import {
  registerEligibilityAllowlist,
  getEligibilityAllowlistRegistration,
} from "../shadow/registries/eligibilityAllowlists.js";

export const PARTICIPANT_CAPABILITY_WAVE1_VERSION = "3b.wave1";

export const PARTICIPANT_CAPABILITY_MODULE_PATHS = Object.freeze({
  executor: "participants/runtime/index.js",
  comparator: "participants/runtime/shadow/comparators/participant.js",
  normalizer: "participants/runtime/shadow/normalizers/participant.js",
});

const WAVE1_METADATA = Object.freeze({
  phase: "3b",
  wave: 1,
  productionEnabled: false,
  shadowEnabled: false,
  persistenceEnabled: false,
  note: "Integrator Wave 1 descriptor registration — Legacy executor only",
});

/**
 * @param {{ ok?: boolean, reasonCode?: string }} result
 * @param {string} label
 * @returns {{ ok: boolean, reasonCode: string|null, alreadyRegistered: boolean, result: unknown }}
 */
function classifyRegistration(result, label, alreadyOk) {
  if (alreadyOk) {
    return {
      ok: true,
      reasonCode: null,
      alreadyRegistered: true,
      label,
      result,
    };
  }
  if (result?.ok === true) {
    return {
      ok: true,
      reasonCode: result.reasonCode ?? null,
      alreadyRegistered: false,
      label,
      result,
    };
  }
  return {
    ok: false,
    reasonCode: result?.reasonCode ?? REGISTRY_REASON_CODE.INVALID_REGISTRY_ENTRY,
    alreadyRegistered: false,
    label,
    result,
  };
}

/**
 * Register PARTICIPANT capability descriptors into Integrator registries.
 * Idempotent: re-running with the same Wave 1 descriptors succeeds as alreadyRegistered.
 *
 * @param {{ includeEligibilityAllowlist?: boolean }} [options]
 * @returns {{
 *   ok: boolean,
 *   version: string,
 *   capability: string,
 *   executor: string,
 *   steps: object[],
 * }}
 */
export function registerParticipantCapabilityWave1(options = {}) {
  const includeEligibilityAllowlist = options.includeEligibilityAllowlist !== false;
  /** @type {object[]} */
  const steps = [];

  // --- Capability executor (LEGACY only) ---
  const existingExec = getCapabilityExecutorRegistration(RUNTIME_CAPABILITY.PARTICIPANT);
  if (
    existingExec &&
    existingExec.executor === RUNTIME_EXECUTOR.LEGACY &&
    existingExec.modulePath === PARTICIPANT_CAPABILITY_MODULE_PATHS.executor
  ) {
    steps.push(
      classifyRegistration(
        { ok: true },
        "capabilityExecutor",
        true
      )
    );
  } else {
    const execResult = registerCapabilityExecutor({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      executor: RUNTIME_EXECUTOR.LEGACY,
      modulePath: PARTICIPANT_CAPABILITY_MODULE_PATHS.executor,
      metadata: WAVE1_METADATA,
    });
    steps.push(classifyRegistration(execResult, "capabilityExecutor", false));
  }

  // --- Shadow comparator descriptor ---
  const existingCmp = getShadowComparatorRegistration(RUNTIME_CAPABILITY.PARTICIPANT);
  if (
    existingCmp &&
    existingCmp.modulePath === PARTICIPANT_CAPABILITY_MODULE_PATHS.comparator
  ) {
    steps.push(classifyRegistration({ ok: true }, "shadowComparator", true));
  } else {
    const cmpResult = registerShadowComparator({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: PARTICIPANT_CAPABILITY_MODULE_PATHS.comparator,
      comparatorId: "PARTICIPANT",
      metadata: WAVE1_METADATA,
    });
    steps.push(classifyRegistration(cmpResult, "shadowComparator", false));
  }

  // --- Shadow normalizer descriptor ---
  const existingNorm = getShadowNormalizerRegistration(RUNTIME_CAPABILITY.PARTICIPANT);
  if (
    existingNorm &&
    existingNorm.modulePath === PARTICIPANT_CAPABILITY_MODULE_PATHS.normalizer
  ) {
    steps.push(classifyRegistration({ ok: true }, "shadowNormalizer", true));
  } else {
    const normResult = registerShadowNormalizer({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: PARTICIPANT_CAPABILITY_MODULE_PATHS.normalizer,
      normalizerId: "PARTICIPANT",
      metadata: WAVE1_METADATA,
    });
    steps.push(classifyRegistration(normResult, "shadowNormalizer", false));
  }

  // --- Eligibility allowlist (descriptor only; resolveShadowEligibility remains unwired) ---
  if (includeEligibilityAllowlist) {
    const existingAllow = getEligibilityAllowlistRegistration(
      RUNTIME_CAPABILITY.PARTICIPANT
    );
    if (
      existingAllow &&
      Array.isArray(existingAllow.operations) &&
      existingAllow.operations.includes("resolve")
    ) {
      steps.push(classifyRegistration({ ok: true }, "eligibilityAllowlist", true));
    } else {
      const allowResult = registerEligibilityAllowlist({
        capability: RUNTIME_CAPABILITY.PARTICIPANT,
        operations: ["resolve"],
        metadata: {
          ...WAVE1_METADATA,
          note: "Descriptor only — resolveShadowEligibility not wired to this registry",
        },
      });
      steps.push(classifyRegistration(allowResult, "eligibilityAllowlist", false));
    }
  }

  const ok = steps.every((s) => s.ok === true);
  const resolved = resolveCapabilityExecutor(RUNTIME_CAPABILITY.PARTICIPANT);

  return {
    ok,
    version: PARTICIPANT_CAPABILITY_WAVE1_VERSION,
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    executor: RUNTIME_EXECUTOR.LEGACY,
    resolvedExecutor: resolved.ok ? resolved.value?.executor : null,
    modulePaths: PARTICIPANT_CAPABILITY_MODULE_PATHS,
    steps,
  };
}
