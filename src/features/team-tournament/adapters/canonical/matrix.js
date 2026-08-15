/**
 * Team Adapter B matrix for Owner reporting (01–16).
 */

import { PRODUCTION_BINDING_STATUS } from "../../../competition-engine/integration/contracts/index.js";
import { TEAM_ADAPTER_B_CATALOG } from "./constants.js";

function rowFrom(adapter, catalogEntry) {
  const sharedRuntime =
    adapter?.sharedRuntime ||
    adapter?.productionBinding ||
    PRODUCTION_BINDING_STATUS.NOT_CONFIGURED;
  const activation = adapter?.activation === true;
  const notConfiguredFakeSuccess = false;
  return Object.freeze({
    ordinal: catalogEntry.ordinal,
    adapterBName: adapter?.adapterBName || catalogEntry.adapterBName,
    classification: adapter?.classification || catalogEntry.classification,
    activation,
    adapterBReady: adapter?.adapterBReady === true,
    sharedRuntime,
    contractId: adapter?.contractId || adapter?.contractName || null,
    contractVersion: adapter?.contractVersion || null,
    ownsAuthority: adapter?.ownsAuthority === true,
    notConfiguredFakeSuccess,
    status:
      adapter?.adapterBReady === true
        ? activation
          ? `ADAPTER_B_READY / SHARED_RUNTIME=${sharedRuntime}`
          : `ADAPTER_B_READY / INACTIVE / SHARED_RUNTIME=${sharedRuntime}`
        : "ADAPTER_B_MISSING",
  });
}

export function buildTeamAdapterBMatrix(registry) {
  const adapters = registry?.adapters || {};
  const rows = TEAM_ADAPTER_B_CATALOG.map((entry) => rowFrom(adapters[entry.ordinal], entry));
  const represented = rows.length === 16 && rows.every((row) => row.adapterBReady === true);
  return Object.freeze({
    ALL_16_TEAM_B_BOUNDARIES_REPRESENTED: represented ? "YES" : "NO",
    rows,
    required: rows.filter((row) => row.classification === "REQUIRED"),
    conditional: rows.filter((row) => row.classification === "CONDITIONAL"),
    optional: rows.filter((row) => row.classification === "OPTIONAL"),
    notRequired: rows.filter((row) => row.classification === "NOT_REQUIRED"),
  });
}
