/**
 * Server/test composition exports — do not import from browser UI trees.
 */

export * from "./publicApi.js";
export {
  createIdempotencyLedger,
  createMemoryIdempotencyLedger,
} from "./createIdempotencyLedger.js";
export { createSystemMessageProducer } from "./createSystemMessageProducer.js";
export { createTrustedCommunicationBackend } from "./createTrustedCommunicationBackend.js";
export {
  assertNoServiceRoleInCommunicationBrowserSurface,
  listCommunicationServerOnlyModulePaths,
} from "./serverOnlyBoundary.js";
