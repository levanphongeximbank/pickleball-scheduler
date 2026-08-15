/**
 * Production-capable durable referee runtime composition.
 *
 * E2E-04 + PR #431 ports + Referee V5 durable persistence infrastructure.
 * Missing durable dependency → fail closed.
 * In-memory / Map runtime is never a production default.
 */

import { createRefereeCompetitionOperationsFacade } from "../../operations/referee/createRefereeCompetitionOperationsFacade.js";
import {
  DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
  IN_MEMORY_RUNTIME_CLASSIFICATION,
  LIVE_RPC_DRIVER_KIND,
  REFEREE_ADAPTER_ERROR_CODE,
  SCHEMA_FAITHFUL_DRIVER_KIND,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { createCanonicalRefereeDurableRuntime } from "./createCanonicalRefereeDurableRuntime.js";
import { createDurableRefereeOperationsStore } from "./createDurableRefereeOperationsStore.js";
import { matchesCanonicalRefereeRuntimePorts } from "./runtimePorts.js";

function rejectInMemoryProductionDriver(driver) {
  if (!driver) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "createCompetitionRefereeProductionRuntime requires durableDriver",
      {}
    );
  }
  if (driver.durable !== true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "In-memory stores cannot be used as production referee runtime",
      { kind: driver.kind || null }
    );
  }
  if (
    driver.kind === "in-memory-referee-operations-store" ||
    driver.kind === "canonical-referee-persistence-runtime" ||
    (driver.classification === IN_MEMORY_RUNTIME_CLASSIFICATION &&
      driver.kind !== SCHEMA_FAITHFUL_DRIVER_KIND)
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "In-memory referee runtime is TEST_DOUBLE_ONLY",
      { kind: driver.kind || null }
    );
  }
}

/**
 * @param {{
 *   durableDriver?: object,
 *   allowTestDoubleDriver?: boolean,
 *   runtimePorts?: object,
 *   clockIso?: string,
 * }} [options]
 */
export function createCompetitionRefereeProductionRuntime(options = {}) {
  const driver = options.durableDriver;
  rejectInMemoryProductionDriver(driver);

  if (
    driver.classification === IN_MEMORY_RUNTIME_CLASSIFICATION &&
    options.allowTestDoubleDriver !== true
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "Schema-faithful test driver is not a live production default",
      { kind: driver.kind }
    );
  }

  if (
    driver.kind === LIVE_RPC_DRIVER_KIND &&
    driver.usesLiveRpc !== true
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Live RPC driver is incomplete",
      {}
    );
  }

  const durableRuntime = createCanonicalRefereeDurableRuntime({
    driver,
    clockIso: options.clockIso,
  });
  if (!matchesCanonicalRefereeRuntimePorts(durableRuntime)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Durable runtime does not implement canonical ports",
      {}
    );
  }

  const opsStore = createDurableRefereeOperationsStore({
    driver,
    clockIso: options.clockIso,
  });

  const facade = createRefereeCompetitionOperationsFacade({
    store: opsStore,
    runtime: {
      classification: DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
      wiredToProductionRuntime: true,
      opsStore,
    },
    runtimePorts: options.runtimePorts,
    clockIso: options.clockIso,
  });

  return Object.freeze({
    kind: "competition-referee-production-runtime",
    classification: DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
    productionRuntimeImplemented: true,
    defaultRuntimeWiringImplemented: true,
    wiredToProductionRuntime: true,
    stagingBackendCertified: false,
    durable: true,
    inMemoryProductionFallback: false,
    usesRefereeV5ScoringEngine: false,
    usesCore16Scoring: true,
    usesCore15Lifecycle: true,
    usesCore17Result: true,
    usesTeamGenericPermission: false,
    usesAdapterB: false,
    identityAuthority: "auth.uid",
    tables: durableRuntime.tables,
    driverKind: driver.kind,
    assignmentRepository: durableRuntime.assignmentRepository,
    matchStateRepository: durableRuntime.matchStateRepository,
    scoringEventLedger: durableRuntime.scoringEventLedger,
    resultRevisionRepository: durableRuntime.resultRevisionRepository,
    opsStore,
    facade,
  });
}
