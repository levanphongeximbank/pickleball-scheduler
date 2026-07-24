/**
 * Communication runtime bootstrap (COMMS-07).
 *
 * Single composition entry for experience gateway selection.
 * Never prints secrets / tokens / message bodies.
 * Never creates a second Supabase singleton.
 * Never falls back to demo in Production builds.
 */

import { createDemoMessagingExperienceGateway } from "../experience/createDemoMessagingExperienceGateway.js";
import { getCommunicationActivationSnapshot } from "../persistence/activationGates.js";
import {
  COMMUNICATION_RUNTIME_MODE,
  COMMUNICATION_RUNTIME_PHASE,
} from "./constants.js";
import { createProductionMessagingExperienceGateway } from "./createProductionMessagingExperienceGateway.js";
import { createUnavailableMessagingExperienceGateway } from "./createUnavailableMessagingExperienceGateway.js";
import { resolveCommunicationRuntimeMode } from "./resolveCommunicationRuntimeMode.js";

const runtimeState = {
  mode: null,
  reason: null,
  initialized: false,
  authenticated: false,
  gateway: null,
  correlationId: null,
  lastError: null,
  demoAllowed: false,
};

/**
 * Safe runtime status (no secrets).
 * @returns {Readonly<object>}
 */
export function getCommunicationRuntimeStatus() {
  return Object.freeze({
    mode: runtimeState.mode,
    reason: runtimeState.reason,
    initialized: runtimeState.initialized,
    authenticated: runtimeState.authenticated,
    lastError: runtimeState.lastError,
    demoAllowed: runtimeState.demoAllowed,
    correlationId: runtimeState.correlationId,
    hasGateway: Boolean(runtimeState.gateway),
    phase: COMMUNICATION_RUNTIME_PHASE.id,
  });
}

/**
 * @returns {object|null}
 */
export function getCommunicationRuntimeGateway() {
  return runtimeState.gateway;
}

export function resetCommunicationRuntime() {
  const previous = runtimeState.gateway;
  if (previous && typeof previous.unsubscribe === "function") {
    try {
      // Best-effort cleanup; individual conversation unsubs managed by UI.
      if (previous.__production?.activeSubscriptionCount?.() > 0) {
        // no-op: UI effect cleanup owns scoped unsubs
      }
    } catch {
      // ignore cleanup errors
    }
  }
  runtimeState.mode = null;
  runtimeState.reason = null;
  runtimeState.initialized = false;
  runtimeState.authenticated = false;
  runtimeState.gateway = null;
  runtimeState.correlationId = null;
  runtimeState.lastError = null;
  runtimeState.demoAllowed = false;
}

/**
 * @param {boolean} authenticated
 */
export function setCommunicationRuntimeAuthenticated(authenticated) {
  runtimeState.authenticated = Boolean(authenticated);
}

/**
 * Bootstrap Communication experience gateway for the current runtime mode.
 *
 * @param {object} [options]
 * @returns {Promise<{ ok: boolean, status: object, gateway: object|null, error?: string }>}
 */
export async function bootstrapCommunicationRuntime(options = {}) {
  const correlationId =
    options.correlationId ||
    `comms07-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // Prevent duplicate gateway instances when already initialized with same mode key.
  const resolution = resolveCommunicationRuntimeMode({
    env: options.env,
    forceMode: options.forceMode,
    allowForceMode: options.allowForceMode === true,
    productionDependenciesCertified:
      options.productionDependenciesCertified === true,
    searchParams: options.searchParams,
    activationSnapshot:
      options.activationSnapshot || getCommunicationActivationSnapshot(),
  });

  const modeKey = `${resolution.mode}:${options.actorParticipantId || ""}:${options.tenantId || ""}:${options.clubId || ""}`;
  if (
    runtimeState.initialized &&
    runtimeState.gateway &&
    runtimeState._modeKey === modeKey &&
    options.forceRebuild !== true
  ) {
    return {
      ok: true,
      status: getCommunicationRuntimeStatus(),
      gateway: runtimeState.gateway,
      reused: true,
    };
  }

  // Cleanup previous gateway subscriptions before replacing.
  if (runtimeState.gateway && typeof options.onReplaceGateway === "function") {
    options.onReplaceGateway(runtimeState.gateway);
  }

  runtimeState.correlationId = correlationId;
  runtimeState.authenticated = Boolean(options.authenticated);
  runtimeState.demoAllowed = resolution.demoAllowed;
  runtimeState.mode = resolution.mode;
  runtimeState.reason = resolution.reason;
  runtimeState.lastError = null;

  try {
    let gateway = null;

    if (resolution.mode === COMMUNICATION_RUNTIME_MODE.DEMO) {
      if (!resolution.demoAllowed) {
        gateway = createUnavailableMessagingExperienceGateway({
          viewerParticipantId: options.actorParticipantId || null,
          tenantId: options.tenantId || null,
          clubId: options.clubId || null,
          correlationId,
          reason: "DEMO_NOT_ALLOWED",
        });
      } else {
        gateway =
          options.demoGateway ||
          createDemoMessagingExperienceGateway({
            viewerParticipantId: options.actorParticipantId || undefined,
            clock: options.clock,
            idProvider: options.idProvider,
            skipSeed: options.skipSeed,
          });
      }
    } else if (resolution.mode === COMMUNICATION_RUNTIME_MODE.PRODUCTION) {
      if (!options.authenticated || !options.actorParticipantId) {
        gateway = createUnavailableMessagingExperienceGateway({
          viewerParticipantId: null,
          tenantId: options.tenantId || null,
          clubId: options.clubId || null,
          correlationId,
          reason: "UNAUTHENTICATED",
        });
        runtimeState.mode = COMMUNICATION_RUNTIME_MODE.UNAVAILABLE;
        runtimeState.reason = "UNAUTHENTICATED";
      } else if (typeof options.createProductionGateway === "function") {
        gateway = await options.createProductionGateway({
          actorParticipantId: options.actorParticipantId,
          tenantId: options.tenantId || null,
          clubId: options.clubId || null,
          correlationId,
          allowUnactivatedComposition:
            options.allowUnactivatedComposition === true,
        });
      } else if (options.productionGateway) {
        gateway = options.productionGateway;
      } else if (
        options.directApp &&
        options.clubApp &&
        options.communityApp
      ) {
        gateway = createProductionMessagingExperienceGateway({
          actorParticipantId: options.actorParticipantId,
          tenantId: options.tenantId || null,
          clubId: options.clubId || null,
          correlationId,
          directApp: options.directApp,
          clubApp: options.clubApp,
          communityApp: options.communityApp,
          playerDisplayPort: options.playerDisplayPort || null,
          identityActorPort: options.identityActorPort || null,
          clubMembershipReader: options.clubMembershipReader || null,
          communityMembershipReader: options.communityMembershipReader || null,
          realtimeAdapter: options.realtimeAdapter || null,
          clock: options.clock,
          idProvider: options.idProvider,
          allowUnactivatedComposition:
            options.allowUnactivatedComposition === true,
          activationSnapshot: options.activationSnapshot,
          onDiagnostic: options.onDiagnostic,
        });
      } else {
        // Production mode requested but deps not certified/injected → UNAVAILABLE.
        gateway = createUnavailableMessagingExperienceGateway({
          viewerParticipantId: options.actorParticipantId,
          tenantId: options.tenantId || null,
          clubId: options.clubId || null,
          correlationId,
          reason: "PRODUCTION_DEPENDENCIES_MISSING",
        });
        runtimeState.mode = COMMUNICATION_RUNTIME_MODE.UNAVAILABLE;
        runtimeState.reason = "PRODUCTION_DEPENDENCIES_MISSING";
      }
    } else {
      gateway = createUnavailableMessagingExperienceGateway({
        viewerParticipantId: options.actorParticipantId || null,
        tenantId: options.tenantId || null,
        clubId: options.clubId || null,
        correlationId,
        reason: resolution.reason || "RUNTIME_UNAVAILABLE",
      });
    }

    runtimeState.gateway = gateway;
    runtimeState.initialized = true;
    runtimeState._modeKey = modeKey;

    return {
      ok: true,
      status: getCommunicationRuntimeStatus(),
      gateway,
      reused: false,
    };
  } catch (error) {
    runtimeState.initialized = false;
    runtimeState.lastError = error?.message || String(error);
    runtimeState.gateway = createUnavailableMessagingExperienceGateway({
      viewerParticipantId: options.actorParticipantId || null,
      tenantId: options.tenantId || null,
      clubId: options.clubId || null,
      correlationId,
      reason: "BOOTSTRAP_FAILURE",
    });
    runtimeState.mode = COMMUNICATION_RUNTIME_MODE.UNAVAILABLE;
    runtimeState.reason = "BOOTSTRAP_FAILURE";
    runtimeState.initialized = true;
    runtimeState._modeKey = modeKey;
    return {
      ok: false,
      status: getCommunicationRuntimeStatus(),
      gateway: runtimeState.gateway,
      error: runtimeState.lastError,
    };
  }
}
