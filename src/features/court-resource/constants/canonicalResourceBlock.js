/**
 * Court Operations — canonical Resource Block business lifecycle contract.
 * Capacity SSOT remains court_resource_reservations (via CourtResourceGateway / Phase 3B).
 * Resource block business SSOT is court_operations_resource_blocks (this package).
 *
 * Owner mapping (Phase 3B vocabulary — never invent court_resource_block):
 *   MAINTENANCE       → maintenance + resource_block
 *   OPERATIONAL_BLOCK → operations  + resource_block
 *
 * Cutover default OFF — not activated in Staging/Production during Batch 4.
 */
export const CANONICAL_RESOURCE_BLOCKS_CONTRACT_VERSION =
  "court-operations.canonical-resource-blocks.v1";

export const CANONICAL_RESOURCE_BLOCKS_TABLE = "court_operations_resource_blocks";
export const CANONICAL_RESOURCE_BLOCKS_COMMAND_LEDGER =
  "court_operations_resource_block_commands";

export const CANONICAL_RESOURCE_BLOCK_CREATE_RPC =
  "court_operations_resource_block_create";
export const CANONICAL_RESOURCE_BLOCK_RESCHEDULE_RPC =
  "court_operations_resource_block_reschedule";
export const CANONICAL_RESOURCE_BLOCK_TRANSFER_RPC =
  "court_operations_resource_block_transfer_court";
export const CANONICAL_RESOURCE_BLOCK_CANCEL_RPC =
  "court_operations_resource_block_cancel";
export const CANONICAL_RESOURCE_BLOCK_GET_RPC =
  "court_operations_resource_block_get";
export const CANONICAL_RESOURCE_BLOCK_LIST_RPC =
  "court_operations_resource_block_list";

export const CANONICAL_RESOURCE_BLOCK_TYPE = Object.freeze({
  MAINTENANCE: "MAINTENANCE",
  OPERATIONAL_BLOCK: "OPERATIONAL_BLOCK",
});

export const CANONICAL_RESOURCE_BLOCK_OWNER_SUB_TYPE = "resource_block";

export const CANONICAL_RESOURCE_BLOCK_LIFECYCLE_STATUS = Object.freeze({
  ACTIVE: "active",
  CANCELLED: "cancelled",
});

/** Global adoption control — OFF until Staging acceptance. */
export const CANONICAL_RESOURCE_BLOCKS_DEFAULT = false;

let resourceBlocksOverride = null;

export function isCanonicalResourceBlocks() {
  if (resourceBlocksOverride === true) return true;
  if (resourceBlocksOverride === false) return false;
  return CANONICAL_RESOURCE_BLOCKS_DEFAULT;
}

/** @internal */
export function __setCanonicalResourceBlocksForTests(enabled) {
  resourceBlocksOverride = enabled === true;
}

/** @internal */
export function __resetCanonicalResourceBlocksForTests() {
  resourceBlocksOverride = null;
}

/**
 * Maps business blockType → Phase 3B capacity owner_type.
 * Returns null for unknown types (fail closed).
 */
export function mapBlockTypeToOwnerType(blockType) {
  const type = String(blockType || "").trim().toUpperCase();
  if (type === CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE) return "maintenance";
  if (type === CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK) return "operations";
  return null;
}
