/**
 * CORE-06 Phase 1D — LineupRandomPort (deterministic seeded selection).
 * No Math.random. No Production adapter in this phase.
 */

import { createLineupRandomSelectRequest } from "../contracts/lineupRandomRequest.js";
import { createMissingLineupResolver } from "../services/missingLineupResolver.js";
import { selectLineupDeterministic } from "../random/selectLineup.js";
import {
  matchesLineupIdempotencyPort,
  createInMemoryLineupIdempotencyPort,
} from "./idempotencyPort.js";

/**
 * @typedef {import('../contracts/lineupRandomRequest.js').LineupRandomSelectRequest} LineupRandomSelectRequest
 * @typedef {import('../contracts/lineupRandomRequest.js').LineupRandomSelectResult} LineupRandomSelectResult
 */

/**
 * @typedef {Object} LineupRandomRequest
 * @property {string} seed
 * @property {unknown} roster
 * @property {unknown} [lineup]
 * @property {unknown} [disciplineTemplate]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} LineupRandomResult
 * @property {boolean} ok
 * @property {unknown[]} [slots]
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {import('../contracts/missingLineupResolution.js').MissingLineupResolution|null} [resolution]
 */

/**
 * @typedef {Object} LineupRandomPort
 * @property {(request: LineupRandomSelectRequest) => LineupRandomSelectResult|Promise<LineupRandomSelectResult>} selectLineup
 * @property {(request: LineupRandomRequest) => LineupRandomResult|Promise<LineupRandomResult>} [fillMissing]
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupRandomPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      (typeof /** @type {{ selectLineup?: unknown }} */ (port).selectLineup ===
        "function" ||
        typeof /** @type {{ fillMissing?: unknown }} */ (port).fillMissing ===
          "function")
  );
}

/**
 * Fail-closed stub — does not invent random selections.
 * @returns {LineupRandomPort}
 */
export function createNoopLineupRandomPort() {
  return {
    async selectLineup() {
      return {
        ok: false,
        deterministic: true,
        selectedSlots: [],
        normalizedSeed: null,
        seedFingerprint: null,
        algorithmId: null,
        algorithmVersion: null,
        inputFingerprint: null,
        selectionFingerprint: null,
        resolution: null,
        code: "LINEUP_RANDOM_NOT_CONFIGURED",
        message: "LineupRandomPort is not configured",
        metadata: {},
      };
    },
    async fillMissing() {
      return {
        ok: false,
        slots: [],
        code: "LINEUP_RANDOM_NOT_CONFIGURED",
        message: "LineupRandomPort is not configured",
        resolution: null,
      };
    },
  };
}

/**
 * In-memory deterministic implementation for tests and isolated domain use.
 * @param {{ idempotency?: import('./idempotencyPort.js').LineupIdempotencyPort }} [options]
 * @returns {LineupRandomPort}
 */
export function createDeterministicLineupRandomPort(options = {}) {
  const idempotency = matchesLineupIdempotencyPort(options.idempotency)
    ? options.idempotency
    : createInMemoryLineupIdempotencyPort();
  const resolver = createMissingLineupResolver({ idempotency });

  return {
    async selectLineup(request) {
      return resolver.resolveMissingLineup(
        createLineupRandomSelectRequest(request || {})
      );
    },
    /**
     * Phase 1C compatibility shim — maps legacy fillMissing shape when possible.
     * Prefer selectLineup for Phase 1D callers.
     */
    async fillMissing(request = {}) {
      const extras =
        request.extras && typeof request.extras === "object"
          ? request.extras
          : {};
      const mapped = createLineupRandomSelectRequest({
        seed: request.seed,
        lineupIdentityKey:
          extras.lineupIdentityKey != null
            ? String(extras.lineupIdentityKey)
            : "",
        rosterSnapshot: request.roster ?? extras.rosterSnapshot ?? null,
        slotTemplate:
          request.disciplineTemplate ?? extras.slotTemplate ?? null,
        policy: extras.policy ?? null,
        scope: extras.scope ?? null,
        actor: extras.actor ?? null,
        source: extras.source ?? null,
        idempotencyKey: extras.idempotencyKey ?? null,
        expectedVersion: extras.expectedVersion ?? null,
        lineupRevisionId: extras.lineupRevisionId ?? null,
        commandId: extras.commandId ?? null,
        extras,
      });
      const result = await resolver.resolveMissingLineup(mapped);
      return {
        ok: result.ok,
        slots: result.selectedSlots,
        code: result.code,
        message: result.message,
        resolution: result.resolution,
      };
    },
  };
}

/**
 * Direct deterministic select without missing-strategy branching (tests).
 * @param {LineupRandomSelectRequest} request
 * @returns {LineupRandomSelectResult}
 */
export function selectLineupViaPortAlgorithm(request) {
  return selectLineupDeterministic(
    createLineupRandomSelectRequest(request || {})
  );
}
