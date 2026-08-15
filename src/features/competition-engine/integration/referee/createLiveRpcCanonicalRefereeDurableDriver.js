/**
 * Production durable driver over Referee V5 internal service-role commit RPCs.
 *
 * Does not execute against Staging/Production in this workstream.
 * Missing rpcClient → fail closed. Browser callers are rejected by the
 * existing internal RPC guard convention.
 */

import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
  LIVE_RPC_DRIVER_KIND,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_V5_INTERNAL_COMMIT_RPC,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, isNonEmptyString, matchStateId } from "./helpers.js";
import { assertServerOnlyPrivilegedRefereeComposition } from "./privilegedCompositionBoundary.js";
import { requireCanonicalRefereeActor } from "./requireCanonicalRefereeActor.js";

function mapRpcFailure(data) {
  const code = String(data?.code || "");
  if (code === "REFEREE_NOT_ASSIGNED") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
      "Referee is not assigned to this match",
      { rpcCode: code }
    );
  }
  if (code === "MATCH_STATE_CONFLICT" || code === "EVENT_SEQUENCE_CONFLICT") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
      "Fail-closed stale write: expectedVersion mismatch",
      { rpcCode: code, currentVersion: data?.currentVersion }
    );
  }
  if (code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IDEMPOTENCY_CONFLICT,
      "Same idempotencyKey with a conflicting request is fail-closed",
      { rpcCode: code }
    );
  }
  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
    data?.error || code || "Durable RPC commit failed",
    { rpcCode: code }
  );
}

/**
 * @param {{ rpcClient?: { rpc: Function, from?: Function }, clockIso?: string }} [options]
 */
export function createLiveRpcCanonicalRefereeDurableDriver(options = {}) {
  assertServerOnlyPrivilegedRefereeComposition();
  const rpcClient = options.rpcClient;
  if (!rpcClient || typeof rpcClient.rpc !== "function") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Live RPC durable driver requires a service-role rpcClient",
      {}
    );
  }

  return Object.freeze({
    kind: LIVE_RPC_DRIVER_KIND,
    classification: DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
    durable: true,
    mirrorsLiveSchema: true,
    usesLiveRpc: true,
    usesRefereeV5ScoringEngine: false,
    usesTeamBridge: false,
    tables: CANONICAL_REFEREE_PERSISTENCE_TABLES,
    rpcNames: REFEREE_V5_INTERNAL_COMMIT_RPC,
    clockIso: isNonEmptyString(options.clockIso)
      ? String(options.clockIso).trim()
      : "2026-07-24T00:00:00.000Z",
    async commitTransition(input, actor) {
      const actorId = requireCanonicalRefereeActor(actor);
      const { data, error } = await rpcClient.rpc(
        REFEREE_V5_INTERNAL_COMMIT_RPC.COMMIT_TRANSITION,
        {
          p_tenant_id: input.tenantId,
          p_tournament_id: input.competitionId || input.tournamentId,
          p_match_id: input.matchId,
          p_actor_id: actorId,
          p_command_type: input.eventType || input.commandType || "CORE_COMMAND",
          p_command_payload: input.payload || {},
          p_expected_state_version: Number(input.expectedVersion || 0),
          p_expected_event_sequence: Number(input.expectedEventSequence || 0),
          p_client_mutation_id: input.commandId || input.idempotencyKey,
          p_idempotency_key: input.idempotencyKey,
          p_request_hash: input.requestHash,
          p_next_state: input.nextState,
          p_generated_events: input.generatedEvents || [],
          p_state_before_hash: input.stateBeforeHash || null,
          p_state_after_hash: input.stateAfterHash || null,
          p_state_before: input.stateBefore || null,
        }
      );
      if (error) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
          error.message || "RPC error",
          {}
        );
      }
      if (data?.ok === false) mapRpcFailure(data);
      return freezeClone(data);
    },
    matchStateId,
  });
}
