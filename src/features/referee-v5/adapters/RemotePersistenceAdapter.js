import { REFEREE_V5_ERROR_VI } from "../persistence/errors.js";
import { LocalPrototypeAdapter } from "./LocalPrototypeAdapter.js";

/**
 * Remote persistence adapter — calls RefereeV5PersistenceService.
 * Production: swap service backend for Supabase RPC / Edge Function.
 */
export class RemotePersistenceAdapter {
  constructor({
    service,
    tenantId,
    tournamentId,
    matchId,
    actor,
    assignment,
  }) {
    this.service = service;
    this.tenantId = tenantId;
    this.tournamentId = tournamentId;
    this.matchId = matchId;
    this.actor = actor;
    this.assignment = assignment;
    this.lastConflict = null;
  }

  async loadMatch() {
    const result = await this.service.getMatchState({
      tenantId: this.tenantId,
      tournamentId: this.tournamentId,
      matchId: this.matchId,
      actor: this.actor,
      assignment: this.assignment,
    });
    if (!result.ok) {
      return result;
    }
    return {
      ok: true,
      state: result.state,
      stateVersion: result.stateVersion,
      lastEventSequence: result.lastEventSequence,
      recentEvents: result.recentEvents,
      permissions: result.permissions,
      serveDirection: result.serveDirection,
    };
  }

  async dispatchCommand({
    commandType,
    payload = {},
    clientMutationId,
    idempotencyKey,
    expectedVersion,
    expectedSequence,
  }) {
    const loaded = await this.loadMatch();
    if (!loaded.ok) {
      return loaded;
    }

    const result = await this.service.applyMatchCommand({
      tenantId: this.tenantId,
      tournamentId: this.tournamentId,
      matchId: this.matchId,
      commandType,
      payload,
      expectedVersion: expectedVersion ?? loaded.stateVersion,
      expectedSequence: expectedSequence ?? loaded.lastEventSequence,
      clientMutationId: clientMutationId || `mut-${Date.now()}`,
      idempotencyKey: idempotencyKey || clientMutationId || `idem-${Date.now()}`,
      actor: this.actor,
      assignment: this.assignment,
    });

    if (!result.ok && result.code === "MATCH_STATE_CONFLICT") {
      this.lastConflict = result;
    }

    if (result.ok && result.duplicate) {
      return { ok: true, duplicate: true, ...result };
    }

    if (!result.ok) {
      return {
        ...result,
        messageVi: REFEREE_V5_ERROR_VI[result.code] || result.error,
      };
    }

    return result;
  }

  async reloadState() {
    this.lastConflict = null;
    return this.loadMatch();
  }

  async finalizeResult({ expectedVersion, idempotencyKey, overrideReason, isOverride = false, forceComplete = false }) {
    const loaded = await this.loadMatch();
    if (!loaded.ok) {
      return loaded;
    }
    return this.service.finalizeMatchResult({
      tenantId: this.tenantId,
      tournamentId: this.tournamentId,
      matchId: this.matchId,
      expectedVersion: expectedVersion ?? loaded.stateVersion,
      idempotencyKey: idempotencyKey || `finalize-${Date.now()}`,
      actor: this.actor,
      assignment: this.assignment,
      overrideReason,
      isOverride,
      forceComplete,
    });
  }
}

export function createRefereeAdapter(mode, options = {}) {
  if (mode === "remote") {
    return new RemotePersistenceAdapter(options);
  }
  return new LocalPrototypeAdapter(options.fixtureId);
}
