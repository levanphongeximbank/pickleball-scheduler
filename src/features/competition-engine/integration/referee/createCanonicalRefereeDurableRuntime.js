/**
 * Canonical ports backed by a durable driver (live RPC or schema-faithful).
 * CORE-15/16/17 remain the business authorities.
 */

import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
  REFEREE_ADAPTER_ERROR_CODE,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, hashCanonical, isNonEmptyString } from "./helpers.js";
import { requireCanonicalRefereeActor } from "./requireCanonicalRefereeActor.js";

export function createCanonicalRefereeDurableRuntime(options = {}) {
  const driver = options.driver;
  if (!driver || driver.durable !== true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Canonical durable runtime requires a durable driver",
      {}
    );
  }

  const assignmentRepository = Object.freeze({
    getActiveForMatch(scope) {
      const row = driver.getAssignment({
        tenantId: scope.tenantId,
        competitionId: scope.competitionId,
        matchId: scope.matchId,
        refereeUserId: scope.refereeUserId,
      });
      return row ? freezeClone(row) : null;
    },
    listByReferee(scope) {
      return driver.listByReferee(scope);
    },
    upsert(row, actor) {
      return driver.upsertAssignment(row, actor);
    },
  });

  const matchStateRepository = Object.freeze({
    getLiveState(scope) {
      const row = driver.getLiveState(scope);
      return row ? freezeClone(row) : null;
    },
    putLiveState(input, actor) {
      requireCanonicalRefereeActor(actor);
      if (!driver.getLiveState(input)) {
        driver.ensureLiveState(input, actor);
      }
      const live = driver.getLiveState(input);
      const expectedVersion =
        input.expectedVersion != null
          ? Number(input.expectedVersion)
          : Number(live?.stateVersion ?? live?.version ?? 0);
      const idempotencyKey = String(
        input.idempotencyKey || input.commandId || ""
      ).trim();
      if (!idempotencyKey) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY,
          "idempotencyKey / commandId is required",
          {}
        );
      }
      const committed = driver.commitTransition(
        {
          ...input,
          expectedVersion,
          idempotencyKey,
          commandId: input.commandId || idempotencyKey,
          eventType: input.eventType || "CORE15_STATE",
          payload: input.statePayload || input.payload || {},
          nextState: input.statePayload || input.nextState || {},
          status: input.status,
        },
        actor
      );
      return freezeClone(committed.live || driver.getLiveState(input));
    },
  });

  const scoringEventLedger = Object.freeze({
    findIdempotent(scope) {
      const row = driver.findIdempotent(scope);
      return row ? freezeClone(row) : null;
    },
    listEvents(scope) {
      return driver.listEvents(scope);
    },
    appendEvent(input, actor) {
      requireCanonicalRefereeActor(actor);
      const idempotencyKey = String(
        input.idempotencyKey || input.commandId || ""
      ).trim();
      if (!idempotencyKey) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY,
          "idempotencyKey / commandId is required",
          {}
        );
      }
      if (!driver.getLiveState(input)) {
        driver.ensureLiveState(input, actor);
      }
      const live = driver.getLiveState(input);
      const requestHash = hashCanonical({
        eventType: input.eventType || "CORE16_COMMAND",
        payload: input.payload || {},
        commandId: input.commandId || idempotencyKey,
      });
      const committed = driver.commitTransition(
        {
          ...input,
          expectedVersion: Number(live?.stateVersion ?? live?.version ?? 0),
          idempotencyKey,
          commandId: input.commandId || idempotencyKey,
          requestHash,
          eventType: input.eventType || "CORE16_COMMAND",
          payload: input.payload || {},
          nextState: {
            ...(live?.statePayload || {}),
            canonical: {
              ...(live?.statePayload?.canonical || {}),
              lastScoringCommand: input.payload || {},
            },
          },
        },
        actor
      );
      return freezeClone({
        ...(committed.event || committed),
        duplicate: Boolean(committed.duplicate),
      });
    },
  });

  const resultRevisionRepository = Object.freeze({
    getActive(scope) {
      const row = driver.getActiveRevision(scope);
      return row ? freezeClone(row) : null;
    },
    appendRevision(input, actor) {
      return driver.appendRevision(input, actor);
    },
  });

  return Object.freeze({
    kind: "canonical-referee-durable-runtime",
    classification: DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
    wiredToProductionRuntime: false,
    durable: true,
    tables: CANONICAL_REFEREE_PERSISTENCE_TABLES,
    usesRefereeV5ScoringEngine: false,
    usesCore16Scoring: true,
    usesCore15Lifecycle: true,
    usesCore17Result: true,
    driverKind: driver.kind,
    assignmentRepository,
    matchStateRepository,
    scoringEventLedger,
    resultRevisionRepository,
    clockIso: isNonEmptyString(options.clockIso)
      ? String(options.clockIso).trim()
      : driver.clockIso,
  });
}
