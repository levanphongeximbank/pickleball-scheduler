/**
 * Immutable catalog of all 16 Owner-approved Canonical Competition Adapter Contracts.
 *
 * Court and Referee are referenced from their existing merged identities.
 * This workstream does not duplicate Court implementation or rename those IDs.
 */

import {
  COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH,
  COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_VERSIONING_POLICY,
  COMPETITION_COURT_RESOURCE_BINDING_PATH,
} from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
} from "../referee/constants.js";
import { WORKSTREAM_CONTRACT_DEFINITIONS } from "./definitions.js";
import {
  COMPETITION_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  OFFICIAL_CONTRACT_COUNT,
  SHARED_ADAPTER_ERROR_CODE,
  THIS_WORKSTREAM_CONTRACT_COUNT,
} from "./kernel/constants.js";
import { failCompetitionAdapter } from "./kernel/errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "./kernel/helpers.js";

function catalogEntryFromDefinition(definition) {
  return freezeClone({
    ordinal: definition.ordinal,
    contractId: definition.contractId,
    contractVersion: definition.contractVersion,
    locked: definition.locked,
    domain: definition.domain,
    authorityOwner: definition.authorityOwner,
    direction: definition.direction,
    runtimeClassification: definition.runtimeClassification,
    productionBinding: definition.productionBinding,
    ownedByThisWorkstream: true,
    mergedVia: null,
    importPath:
      "src/features/competition-engine/integration/contracts/definitions.js",
    workstreamStatus: "LOCKED_V1_THIS_WORKSTREAM",
  });
}

const COURT_CATALOG_ENTRY = freezeClone({
  ordinal: 7,
  contractId: COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  contractVersion: String(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION),
  locked: COMPETITION_COURT_ADAPTER_VERSIONING_POLICY.SILENT_IN_PLACE_BREAKING_CHANGE_FORBIDDEN === true,
  domain: "court",
  authorityOwner: "src/features/court-resource",
  direction: "INBOUND_QUERY",
  runtimeClassification: "EXISTING_CANONICAL_CAPABILITY",
  productionBinding: "BOUND",
  ownedByThisWorkstream: false,
  mergedVia: "PR #432",
  importPath: COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH,
  bindingPath: COMPETITION_COURT_RESOURCE_BINDING_PATH,
  workstreamStatus: "MERGED_ON_MAIN_EXTERNAL_TO_THIS_WORKSTREAM",
});

const REFEREE_CATALOG_ENTRY = freezeClone({
  ordinal: 8,
  contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  locked: COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED === true,
  domain: "referee",
  authorityOwner: "competition-core referee runtime + identity",
  direction: "INBOUND_QUERY",
  runtimeClassification: "EXISTING_CANONICAL_CAPABILITY",
  productionBinding: "PARTIAL",
  ownedByThisWorkstream: false,
  mergedVia: "PR #431",
  importPath:
    "src/features/competition-engine/integration/referee/constants.js",
  workstreamStatus: "MERGED_ON_MAIN_EXTERNAL_TO_THIS_WORKSTREAM",
});

const OFFICIAL_CATALOG_ENTRIES = Object.freeze(
  [
    ...WORKSTREAM_CONTRACT_DEFINITIONS.map(catalogEntryFromDefinition),
    COURT_CATALOG_ENTRY,
    REFEREE_CATALOG_ENTRY,
  ].sort((a, b) => a.ordinal - b.ordinal)
);

/**
 * @param {unknown[]} [entries]
 */
export function createCompetitionAdapterContractCatalog(entries) {
  const source = Array.isArray(entries) ? entries : OFFICIAL_CATALOG_ENTRIES;
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (let i = 0; i < source.length; i += 1) {
    const entry = source[i];
    if (!isPlainObject(entry) || !isNonEmptyString(entry.contractId)) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
        "Catalog entry must include contractId",
        { index: i }
      );
    }
    if (byId.has(entry.contractId)) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.DUPLICATE_REGISTRATION,
        `Duplicate catalog contractId: ${entry.contractId}`,
        { contractId: entry.contractId, index: i }
      );
    }
    byId.set(entry.contractId, freezeClone(entry));
  }

  let frozen = true;
  const list = Object.freeze([...byId.values()].sort((a, b) => a.ordinal - b.ordinal));

  return Object.freeze({
    kind: "competition-adapter-contract-catalog",
    frozen: true,
    size() {
      return byId.size;
    },
    listCompetitionAdapterContracts() {
      return list;
    },
    getCompetitionAdapterContract(id) {
      if (!isNonEmptyString(id)) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.UNKNOWN_CONTRACT,
          "contractId is required",
          {}
        );
      }
      const entry = byId.get(String(id).trim());
      if (!entry) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.UNKNOWN_CONTRACT,
          `Unknown competition adapter contract: ${id}`,
          { contractId: id }
        );
      }
      return entry;
    },
    assertKnownCompetitionAdapterContract(id, version) {
      const entry = this.getCompetitionAdapterContract(id);
      const expected = String(entry.contractVersion);
      const provided = version == null ? "" : String(version);
      if (provided !== expected) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION,
          `Contract version mismatch for ${id}`,
          { contractId: id, expected, provided }
        );
      }
      if (entry.locked !== true) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
          `Contract ${id} must be locked`,
          { contractId: id }
        );
      }
      return entry;
    },
    register() {
      if (frozen) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.REGISTRY_FROZEN,
          "Competition adapter catalog is immutable after construction",
          {}
        );
      }
    },
  });
}

export const OFFICIAL_COMPETITION_ADAPTER_CATALOG =
  createCompetitionAdapterContractCatalog();

export function getCompetitionAdapterContract(id) {
  return OFFICIAL_COMPETITION_ADAPTER_CATALOG.getCompetitionAdapterContract(id);
}

export function listCompetitionAdapterContracts() {
  return OFFICIAL_COMPETITION_ADAPTER_CATALOG.listCompetitionAdapterContracts();
}

export function assertKnownCompetitionAdapterContract(id, version) {
  return OFFICIAL_COMPETITION_ADAPTER_CATALOG.assertKnownCompetitionAdapterContract(
    id,
    version
  );
}

export const OFFICIAL_CATALOG_META = Object.freeze({
  officialContractCount: OFFICIAL_CONTRACT_COUNT,
  thisWorkstreamContractCount: THIS_WORKSTREAM_CONTRACT_COUNT,
  ownedContractVersion: COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  ownedLocked: COMPETITION_ADAPTER_CONTRACT_LOCKED,
  courtContractId: COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  courtContractVersion: String(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION),
  refereeContractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  refereeContractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
});
