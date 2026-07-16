/**
 * P1.2 S1-D — runSetupMutation orchestration foundation.
 * Preview → explicit confirm → repository executeSetupMutation → reload.
 * Default runtime stays v6; foundation is opt-in via gate + callers.
 */

import {
  buildSetupMutationEnvelope,
  buildSetupMutationEnvelopeAsync,
  DEFAULT_ENGINE_VERSION,
  validateSetupMutationEnvelope,
  validateSetupMutationEnvelopeAsync,
} from "../canonical/teamTournamentMutationEnvelope.js";
import {
  hashEngineInput,
  hashEngineInputAsync,
  hashEngineOutput,
  hashEngineOutputAsync,
} from "../canonical/teamTournamentCanonical.js";
import { createTeamTournamentIdempotencyKey } from "../services/teamTournamentRpcService.js";
import {
  beginUiCommandKey,
  buildUiCommandScope,
  endUiCommandKey,
} from "../ui/teamTournamentUiCommandKeys.js";
import { resolveUiTeamTournamentDataMode } from "../repositories/teamTournamentRepositoryFactory.js";
import { SETUP_MUTATION_CODES, SETUP_MUTATION_STATUS } from "./setupMutationCodes.js";
import {
  isSetupMutationFoundationEnabled,
  rejectIfSetupMutationGateOff,
} from "./setupMutationFeatureGate.js";
import {
  evaluateEngineVersionPolicy,
  evaluateSetupDriftPolicy,
} from "./setupMutationPolicy.js";
import {
  isSetupDomainWriteMethodActive,
  resolveSetupMutationRpcName,
} from "./setupMutationRpcRegistry.js";

/** @type {Map<string, { envelope: object, createdAt: number, tournamentVersion: number }>} */
const previewSessions = new Map();

/** @type {Map<string, number>} */
const latestObservedVersions = new Map();

function previewKey(tournamentId, idempotencyKey) {
  return `${String(tournamentId)}::${String(idempotencyKey)}`;
}

function mapHashRuntimeFailure(error) {
  const message = error?.message || "Không tính được hash setup mutation.";
  const isHashRuntime =
    /hashUtf8Sha256Sync is unavailable|SubtleCrypto|digest/i.test(message) ||
    error?.code === SETUP_MUTATION_CODES.HASH_RUNTIME_ERROR;
  return {
    ok: false,
    code: isHashRuntime
      ? SETUP_MUTATION_CODES.HASH_RUNTIME_ERROR
      : SETUP_MUTATION_CODES.VALIDATION_ERROR,
    error: message,
  };
}

function finishBuiltPayload(validation, engineInputHash, engineOutputHash, engineVersion, rulesVersion) {
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      error: validation.error,
    };
  }

  return {
    ok: true,
    envelope: validation.envelope,
    engineInputHash,
    engineOutputHash,
    engineVersion,
    rulesVersion,
    payloadHash: validation.envelope.payloadHash,
    rpcName: resolveSetupMutationRpcName(validation.envelope.commandName),
  };
}

/**
 * Node/tests/scripts only — browser UI path uses buildSetupMutationPayloadAsync.
 * @param {object} params
 */
export function buildSetupMutationPayload(params = {}) {
  try {
    const commandName = params.commandName || params.method;
    const tournamentId = String(params.tournamentId || "").trim();
    const expectedTournamentVersion = Number(
      params.expectedTournamentVersion ?? params.latestTournamentVersion ?? params.version
    );
    const idempotencyKey = String(
      params.idempotencyKey || createTeamTournamentIdempotencyKey("tt-setup")
    ).trim();

    const engineInput = params.engineInput ?? {};
    const engineOutput = params.engineOutput ?? {};
    const engineInputHash = params.engineInputHash || hashEngineInput(engineInput);
    const engineOutputHash = params.engineOutputHash || hashEngineOutput(engineOutput);
    const engineVersion = params.engineVersion || DEFAULT_ENGINE_VERSION;
    const rulesVersion = params.rulesVersion || "";

    const envelope = buildSetupMutationEnvelope({
      commandName,
      tournamentId,
      expectedTournamentVersion,
      idempotencyKey,
      engineVersion,
      rulesVersion,
      engineInputHash,
      engineOutputHash,
      generatedAt: params.generatedAt,
      generationMetadata: params.generationMetadata || {
        source: "runSetupMutation",
        method: params.method || commandName,
      },
      confirmDestructive: params.confirmDestructive === true,
      payload: params.payload ?? {},
    });

    return finishBuiltPayload(
      validateSetupMutationEnvelope(envelope),
      engineInputHash,
      engineOutputHash,
      engineVersion,
      rulesVersion
    );
  } catch (error) {
    return mapHashRuntimeFailure(error);
  }
}

/**
 * Browser-safe payload/envelope builder (SubtleCrypto SHA-256).
 * @param {object} params
 */
export async function buildSetupMutationPayloadAsync(params = {}) {
  try {
    const commandName = params.commandName || params.method;
    const tournamentId = String(params.tournamentId || "").trim();
    const expectedTournamentVersion = Number(
      params.expectedTournamentVersion ?? params.latestTournamentVersion ?? params.version
    );
    const idempotencyKey = String(
      params.idempotencyKey || createTeamTournamentIdempotencyKey("tt-setup")
    ).trim();

    const engineInput = params.engineInput ?? {};
    const engineOutput = params.engineOutput ?? {};
    const engineInputHash = params.engineInputHash || (await hashEngineInputAsync(engineInput));
    const engineOutputHash = params.engineOutputHash || (await hashEngineOutputAsync(engineOutput));
    const engineVersion = params.engineVersion || DEFAULT_ENGINE_VERSION;
    const rulesVersion = params.rulesVersion || "";

    const envelope = await buildSetupMutationEnvelopeAsync({
      commandName,
      tournamentId,
      expectedTournamentVersion,
      idempotencyKey,
      engineVersion,
      rulesVersion,
      engineInputHash,
      engineOutputHash,
      generatedAt: params.generatedAt,
      generationMetadata: params.generationMetadata || {
        source: "runSetupMutation",
        method: params.method || commandName,
      },
      confirmDestructive: params.confirmDestructive === true,
      payload: params.payload ?? {},
    });

    return finishBuiltPayload(
      await validateSetupMutationEnvelopeAsync(envelope),
      engineInputHash,
      engineOutputHash,
      engineVersion,
      rulesVersion
    );
  } catch (error) {
    return mapHashRuntimeFailure(error);
  }
}

function registerPreviewSession(built) {
  const key = previewKey(built.envelope.tournamentId, built.envelope.idempotencyKey);
  previewSessions.set(key, {
    envelope: built.envelope,
    createdAt: Date.now(),
    tournamentVersion: built.envelope.expectedTournamentVersion,
  });

  return {
    ok: true,
    status: SETUP_MUTATION_STATUS.PREVIEW,
    mode: "preview",
    requiresConfirm: true,
    rpcCalled: false,
    envelope: built.envelope,
    engineInputHash: built.engineInputHash,
    engineOutputHash: built.engineOutputHash,
    payloadHash: built.payloadHash,
    engineVersion: built.engineVersion,
    rulesVersion: built.rulesVersion,
    rpcName: built.rpcName,
    domainWriteActive: isSetupDomainWriteMethodActive(),
  };
}

/**
 * Preview-only — builds envelope, never calls repository/RPC.
 * Node/tests only — browser UI path uses previewSetupMutationAsync.
 * @param {object} params
 */
export function previewSetupMutation(params = {}) {
  const gateError = rejectIfSetupMutationGateOff(params.envSource);
  if (gateError) {
    return { ...gateError, status: SETUP_MUTATION_STATUS.BLOCKED };
  }

  const built = buildSetupMutationPayload(params);
  if (!built.ok) {
    return { ...built, status: SETUP_MUTATION_STATUS.FAILED };
  }

  const preview = registerPreviewSession(built);
  if (typeof params.onPreview === "function") {
    params.onPreview(preview);
  }
  return preview;
}

/**
 * Browser-safe preview (async hashing). Never calls repository/RPC.
 * @param {object} params
 */
export async function previewSetupMutationAsync(params = {}) {
  const gateError = rejectIfSetupMutationGateOff(params.envSource);
  if (gateError) {
    return { ...gateError, status: SETUP_MUTATION_STATUS.BLOCKED };
  }

  const built = await buildSetupMutationPayloadAsync(params);
  if (!built.ok) {
    return { ...built, status: SETUP_MUTATION_STATUS.FAILED };
  }

  const preview = registerPreviewSession(built);
  if (typeof params.onPreview === "function") {
    params.onPreview(preview);
  }
  return preview;
}

/**
 * @param {object} conflictResult
 * @param {{ reload?: Function }} [handlers]
 */
export async function handleSetupMutationConflict(conflictResult, handlers = {}) {
  const code = String(conflictResult?.code || "");

  if (code === SETUP_MUTATION_CODES.VERSION_CONFLICT || code === "version_conflict") {
    let reloaded = null;
    if (typeof handlers.reload === "function") {
      reloaded = await handlers.reload({ silent: true, reason: "VERSION_CONFLICT" });
    }
    return {
      ok: false,
      code: SETUP_MUTATION_CODES.VERSION_CONFLICT,
      error:
        conflictResult?.error ||
        "VERSION_CONFLICT — đã reload; không tự gửi lại. Hãy preview lại.",
      reloaded: true,
      autoResubmit: false,
      reloadResult: reloaded,
      status: SETUP_MUTATION_STATUS.CONFLICT,
    };
  }

  if (code === SETUP_MUTATION_CODES.IDEMPOTENCY_KEY_REUSED || code === "idempotency_key_reused") {
    return {
      ok: false,
      code: SETUP_MUTATION_CODES.IDEMPOTENCY_KEY_REUSED,
      error:
        conflictResult?.error ||
        "IDEMPOTENCY_KEY_REUSED — cần preview/command mới (không tái sử dụng key cũ cho lệnh khác).",
      requiresNewPreview: true,
      status: SETUP_MUTATION_STATUS.CONFLICT,
    };
  }

  return {
    ok: false,
    code: code || SETUP_MUTATION_CODES.VALIDATION_ERROR,
    error: conflictResult?.error || "Setup mutation conflict.",
    status: SETUP_MUTATION_STATUS.FAILED,
  };
}

function observeVersion(tournamentId, version) {
  const id = String(tournamentId || "");
  const v = Number(version);
  if (!id || !Number.isFinite(v)) {
    return;
  }
  const prev = latestObservedVersions.get(id) || 0;
  if (v > prev) {
    latestObservedVersions.set(id, v);
  }
}

/**
 * Ignore stale mutation responses that would overwrite a newer setup version.
 * @param {string} tournamentId
 * @param {number|null|undefined} responseVersion
 */
export function shouldIgnoreStaleSetupMutationResponse(tournamentId, responseVersion) {
  const latest = latestObservedVersions.get(String(tournamentId || "")) || 0;
  const response = Number(responseVersion);
  if (!Number.isFinite(response)) {
    return false;
  }
  return latest > 0 && response < latest;
}

/**
 * Confirm path — requires explicit confirm; may call repository.executeSetupMutation.
 * @param {object} params
 */
export async function confirmSetupMutation(params = {}) {
  const gateError = rejectIfSetupMutationGateOff(params.envSource);
  if (gateError) {
    return { ...gateError, status: SETUP_MUTATION_STATUS.BLOCKED };
  }

  if (params.confirmed !== true) {
    return {
      ok: false,
      code: SETUP_MUTATION_CODES.CONFIRM_REQUIRED,
      error: "Cần confirm tường minh trước khi persist setup mutation.",
      status: SETUP_MUTATION_STATUS.BLOCKED,
      rpcCalled: false,
    };
  }

  const dataMode = params.dataMode || resolveUiTeamTournamentDataMode();
  const drift = evaluateSetupDriftPolicy({
    dataMode,
    driftDetected: params.driftDetected,
    diagnostic: params.diagnostic,
    confirmDestructive: params.confirmDestructive === true || params.envelope?.confirmDestructive === true,
    reloadAcknowledged: params.reloadAcknowledged === true,
  });

  if (!drift.allow) {
    return {
      ok: false,
      code: drift.code,
      error: drift.error,
      warn: drift.warn,
      setupBlocked: drift.setupBlocked,
      setupBlockCode: drift.setupBlockCode,
      status: SETUP_MUTATION_STATUS.BLOCKED,
      rpcCalled: false,
    };
  }

  const enginePolicy = evaluateEngineVersionPolicy({
    snapshotEngineVersion: params.snapshotMeta?.engineVersion ?? params.snapshot?.engineVersion,
    currentEngineVersion: params.engineVersion || DEFAULT_ENGINE_VERSION,
    allowRebuild: params.allowEngineRebuild === true,
    phase: "confirm",
  });
  if (!enginePolicy.allowConfirm) {
    return {
      ok: false,
      code: enginePolicy.code,
      error: enginePolicy.error,
      warn: enginePolicy.warn,
      status: SETUP_MUTATION_STATUS.BLOCKED,
      rpcCalled: false,
    };
  }

  let envelope = params.envelope;
  if (!envelope) {
    const built = await buildSetupMutationPayloadAsync(params);
    if (!built.ok) {
      return { ...built, status: SETUP_MUTATION_STATUS.FAILED, rpcCalled: false };
    }
    envelope = built.envelope;
  }

  const validated = await validateSetupMutationEnvelopeAsync(envelope);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      error: validated.error,
      status: SETUP_MUTATION_STATUS.FAILED,
      rpcCalled: false,
    };
  }
  envelope = validated.envelope;

  const sessionKey = previewKey(envelope.tournamentId, envelope.idempotencyKey);
  if (!previewSessions.has(sessionKey) && params.requirePreviewSession !== false) {
    // Allow direct confirm in tests when requirePreviewSession=false; default prefers preview first.
    if (params.requirePreviewSession === true) {
      return {
        ok: false,
        code: SETUP_MUTATION_CODES.CONFIRM_REQUIRED,
        error: "Chưa có preview session — hãy gọi previewSetupMutation trước.",
        status: SETUP_MUTATION_STATUS.BLOCKED,
        rpcCalled: false,
      };
    }
  }

  const scope = params.actionScope || buildUiCommandScope(
    envelope.commandName,
    envelope.tournamentId,
    "setup"
  );
  const inFlightKey = beginUiCommandKey(scope);
  if (params.idempotencyKey && inFlightKey !== params.idempotencyKey && params.dedupeMultiTab !== false) {
    // Multi-tab: reuse the first in-flight key for the same scope.
    if (previewSessions.has(previewKey(envelope.tournamentId, inFlightKey))) {
      return {
        ok: false,
        code: SETUP_MUTATION_CODES.DUPLICATE_COMMAND,
        error: "Lệnh setup đang chạy ở tab/phiên khác — đã dedupe.",
        idempotencyKey: inFlightKey,
        status: SETUP_MUTATION_STATUS.BLOCKED,
        rpcCalled: false,
      };
    }
  }

  const repo = params.repository;
  if (!repo || typeof repo.executeSetupMutation !== "function") {
    endUiCommandKey(scope);
    return {
      ok: false,
      code: SETUP_MUTATION_CODES.NOT_IMPLEMENTED,
      error: "Repository.executeSetupMutation không khả dụng.",
      status: SETUP_MUTATION_STATUS.FAILED,
      rpcCalled: false,
    };
  }

  observeVersion(envelope.tournamentId, params.latestTournamentVersion);

  const rpcName = resolveSetupMutationRpcName(envelope.commandName);
  let result;
  try {
    result = await repo.executeSetupMutation({
      rpcName,
      tournamentId: envelope.tournamentId,
      envelope,
      envSource: params.envSource,
    });
  } catch (error) {
    endUiCommandKey(scope);
    return {
      ok: false,
      code: SETUP_MUTATION_CODES.VALIDATION_ERROR,
      error: error?.message || "executeSetupMutation exception",
      status: SETUP_MUTATION_STATUS.FAILED,
      rpcCalled: true,
    };
  }

  const rpcCalled = true;

  if (!result?.ok) {
    const code = String(result?.code || "");
    if (
      code === SETUP_MUTATION_CODES.VERSION_CONFLICT ||
      code === "version_conflict" ||
      code === SETUP_MUTATION_CODES.IDEMPOTENCY_KEY_REUSED ||
      code === "idempotency_key_reused"
    ) {
      endUiCommandKey(scope);
      return handleSetupMutationConflict(result, { reload: params.reload });
    }

    // Undeployed RPC / validation — clear key so caller can retry same command after fix
    if (
      code === SETUP_MUTATION_CODES.RPC_NOT_DEPLOYED ||
      code === "REPOSITORY_RPC_GUARD_NOT_DEPLOYED"
    ) {
      endUiCommandKey(scope);
      previewSessions.delete(sessionKey);
      return {
        ...result,
        rpcCalled,
        status: SETUP_MUTATION_STATUS.FAILED,
        warn: drift.warn || enginePolicy.warn,
      };
    }

    // Network-ish failures keep idempotency key for retry
    if (params.clearIdempotencyOnFailure === true) {
      endUiCommandKey(scope);
    }

    return {
      ...result,
      rpcCalled,
      status: SETUP_MUTATION_STATUS.FAILED,
      idempotencyKey: envelope.idempotencyKey,
      retrySameIdempotencyKey: true,
    };
  }

  if (shouldIgnoreStaleSetupMutationResponse(envelope.tournamentId, result.version)) {
    endUiCommandKey(scope);
    return {
      ok: false,
      code: SETUP_MUTATION_CODES.STALE_RESPONSE,
      error: "Bỏ qua phản hồi setup mutation cũ — đã có phiên bản mới hơn.",
      status: SETUP_MUTATION_STATUS.FAILED,
      rpcCalled,
      ignored: true,
    };
  }

  observeVersion(envelope.tournamentId, result.version);

  let reloadResult = null;
  if (typeof params.reload === "function") {
    reloadResult = await params.reload({
      silent: true,
      schemaVersion: 7,
      diagnostic: params.diagnostic === true || params.readDiagnostic === true,
    });
    if (reloadResult?.version != null) {
      observeVersion(envelope.tournamentId, reloadResult.version);
    }
  }

  endUiCommandKey(scope);
  previewSessions.delete(sessionKey);

  return {
    ok: true,
    status: SETUP_MUTATION_STATUS.SUCCESS,
    rpcCalled,
    replayed: result.replayed === true,
    envelope,
    snapshot: result.data?.snapshot || result.snapshot || null,
    snapshotMeta: result.data?.snapshot || result.snapshot || null,
    version: result.version,
    data: result.data,
    reloadResult,
    warn: drift.warn || enginePolicy.warn,
    setupBlocked: false,
    setupBlockCode: null,
  };
}

/**
 * Orchestrates preview → optional onConfirm → persistence.
 *
 * @param {object} params
 * @param {string} params.method command name alias
 * @param {string} [params.clubId]
 * @param {string} params.tournamentId
 * @param {object} [params.engineInput]
 * @param {object} [params.engineOutput]
 * @param {object} [params.payload]
 * @param {object} [params.commandOptions]
 * @param {Function} [params.onPreview]
 * @param {Function} [params.onConfirm] async (preview) => boolean
 */
export async function runSetupMutation(params = {}) {
  if (!isSetupMutationFoundationEnabled(params.envSource) && params.bypassGate !== true) {
    return {
      ...rejectIfSetupMutationGateOff(params.envSource),
      status: SETUP_MUTATION_STATUS.BLOCKED,
      rpcCalled: false,
    };
  }

  const commandOptions = params.commandOptions || {};
  const scope = params.actionScope || buildUiCommandScope(
    params.method || params.commandName || "setup",
    params.tournamentId,
    "setup"
  );

  const idempotencyKey =
    commandOptions.idempotencyKey ||
    params.idempotencyKey ||
    beginUiCommandKey(scope);

  const preview = await previewSetupMutationAsync({
    ...params,
    method: params.method || params.commandName,
    commandName: params.commandName || params.method,
    idempotencyKey,
    expectedTournamentVersion:
      commandOptions.expectedVersion ??
      params.expectedTournamentVersion ??
      params.latestTournamentVersion,
    confirmDestructive: params.confirmDestructive ?? commandOptions.confirmDestructive,
  });

  if (!preview.ok) {
    return preview;
  }

  let confirmed = params.confirmed === true;
  if (!confirmed && typeof params.onConfirm === "function") {
    confirmed = (await params.onConfirm(preview)) === true;
  }

  if (!confirmed) {
    return {
      ok: true,
      status: SETUP_MUTATION_STATUS.PREVIEW,
      mode: "preview-only",
      requiresConfirm: true,
      rpcCalled: false,
      envelope: preview.envelope,
      engineInputHash: preview.engineInputHash,
      engineOutputHash: preview.engineOutputHash,
      payloadHash: preview.payloadHash,
      code: SETUP_MUTATION_CODES.PREVIEW_ONLY,
    };
  }

  return confirmSetupMutation({
    ...params,
    confirmed: true,
    envelope: preview.envelope,
    idempotencyKey,
    actionScope: scope,
    requirePreviewSession: false,
    envSource: params.envSource,
  });
}

/** @internal test helper */
export function __resetSetupMutationFoundationStateForTests() {
  previewSessions.clear();
  latestObservedVersions.clear();
}

export {
  previewSessions as __previewSessionsForTests,
  latestObservedVersions as __latestObservedVersionsForTests,
};
