/**
 * P1.2 S1-D — repository executeSetupMutation transport foundation.
 * Fail-closed for undeployed domain RPCs. No blob fallback. No fake success.
 * Browser-safe: envelope re-validation uses async SubtleCrypto hashing only.
 */

import {
  validateSetupMutationEnvelopeAsync,
} from "../canonical/teamTournamentMutationEnvelope.js";
import {
  repositoryFailure,
  repositorySuccess,
  normalizeRepositoryResult,
} from "../repositories/TeamTournamentRepository.interface.js";
import { REPOSITORY_ERROR_CODES } from "../repositories/teamTournamentRepositoryTypes.js";
import { SETUP_MUTATION_CODES } from "./setupMutationCodes.js";
import {
  isSetupMutationRpcDeployed,
  resolveSetupMutationRpcName,
} from "./setupMutationRpcRegistry.js";
import { rejectIfSetupMutationGateOff } from "./setupMutationFeatureGate.js";

/**
 * Normalize cloud RPC success / replay into repository shape.
 * @param {object} rpcResult
 * @param {string} provider
 */
export function normalizeSetupMutationRpcResult(rpcResult, provider = "cloud") {
  if (!rpcResult || rpcResult.ok !== true) {
    return normalizeRepositoryResult(rpcResult || {
      ok: false,
      code: SETUP_MUTATION_CODES.VALIDATION_ERROR,
      error: "Setup mutation RPC thất bại.",
    }, { provider });
  }

  const snapshot = rpcResult.snapshot || rpcResult.snapshotMeta || null;
  return repositorySuccess(
    {
      snapshot,
      snapshotId: snapshot?.snapshotId ?? rpcResult.snapshotId ?? null,
      snapshotVersion: snapshot?.snapshotVersion ?? rpcResult.snapshotVersion ?? null,
      snapshotHash: snapshot?.snapshotHash ?? rpcResult.snapshotHash ?? null,
      normalizedReadHash: snapshot?.normalizedReadHash ?? rpcResult.normalizedReadHash ?? null,
      commandName: rpcResult.commandName || snapshot?.commandName || null,
    },
    {
      provider,
      version: rpcResult.version ?? rpcResult.tournamentVersion ?? snapshot?.snapshotVersion ?? null,
      replayed: rpcResult.replayed === true || rpcResult.replay === true,
      code: rpcResult.code || null,
    }
  );
}

/**
 * Shared executeSetupMutation — used by cloud/blob/shadow repositories.
 *
 * @param {object} params
 * @param {string} [params.rpcName]
 * @param {string} params.tournamentId
 * @param {object} params.envelope
 * @param {'cloud'|'blob'|'shadow'} [params.provider]
 * @param {(rpcName: string, args: object) => Promise<object>} [params.callRpc]
 *   Optional future transport. Ignored while RPCs are undeployed.
 * @returns {Promise<object>}
 */
export async function executeSetupMutation(params = {}) {
  const provider = params.provider || "cloud";
  const gateError = rejectIfSetupMutationGateOff(params.envSource);
  if (gateError) {
    return gateError;
  }

  if (provider === "blob") {
    return repositoryFailure(
      SETUP_MUTATION_CODES.BLOB_FALLBACK_FORBIDDEN,
      "Setup mutation không được fallback blob/localStorage trong cloud foundation.",
      { provider, tournamentId: params.tournamentId }
    );
  }

  const envelope = params.envelope;
  if (!envelope || typeof envelope !== "object") {
    return repositoryFailure(
      SETUP_MUTATION_CODES.MISSING_ENVELOPE,
      "Thiếu mutation envelope.",
      { provider }
    );
  }

  let validated;
  try {
    validated = await validateSetupMutationEnvelopeAsync(envelope);
  } catch (error) {
    const message = error?.message || "Không xác thực được envelope setup mutation.";
    return repositoryFailure(
      /unavailable in browser runtime|SubtleCrypto|digest|HASH_RUNTIME/i.test(message)
        ? SETUP_MUTATION_CODES.HASH_RUNTIME_ERROR
        : SETUP_MUTATION_CODES.VALIDATION_ERROR,
      message,
      { provider }
    );
  }
  if (!validated.ok) {
    return repositoryFailure(validated.code || SETUP_MUTATION_CODES.VALIDATION_ERROR, validated.error, {
      provider,
    });
  }

  const commandName = validated.envelope.commandName;
  const resolvedRpc = resolveSetupMutationRpcName(commandName);
  const rpcName = String(params.rpcName || resolvedRpc || "").trim();

  if (!rpcName || !resolvedRpc) {
    return repositoryFailure(
      SETUP_MUTATION_CODES.NOT_IMPLEMENTED,
      `Setup command chưa đăng ký RPC: ${commandName}`,
      { provider, commandName }
    );
  }

  if (params.rpcName && resolvedRpc && params.rpcName !== resolvedRpc) {
    return repositoryFailure(
      SETUP_MUTATION_CODES.VALIDATION_ERROR,
      `rpcName không khớp command registry (${params.rpcName} ≠ ${resolvedRpc}).`,
      { provider, commandName, rpcName: params.rpcName }
    );
  }

  if (!isSetupMutationRpcDeployed(rpcName)) {
    return repositoryFailure(
      REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED,
      `${rpcName} chưa deploy — setup domain RPC fail-closed (S1-D/S1-E).`,
      {
        provider,
        methodName: "executeSetupMutation",
        rpcName,
        commandName,
        tournamentId: params.tournamentId,
        sqlSection: "P1.2 domain RPCs (not in this milestone)",
      }
    );
  }

  // Future path — only reachable when isSetupMutationRpcDeployed flips true.
  if (typeof params.callRpc !== "function") {
    return repositoryFailure(
      SETUP_MUTATION_CODES.NOT_IMPLEMENTED,
      `${rpcName} marked deployed nhưng thiếu callRpc transport.`,
      { provider, rpcName }
    );
  }

  const rpcResult = await params.callRpc(rpcName, {
    p_tournament_id: String(params.tournamentId || validated.envelope.tournamentId),
    p_envelope: validated.envelope,
    p_expected_version: validated.envelope.expectedTournamentVersion,
    p_idempotency_key: validated.envelope.idempotencyKey,
  });

  return normalizeSetupMutationRpcResult(rpcResult, provider);
}
