/**
 * CORE-22 adapter surface + default registry factory.
 */

import { createAdapterRegistry } from "./registry.js";
import { createCore19WorkflowAdapter, CORE19_MODULE_ID } from "./core19-workflow.js";
import { createCore20AuditAdapter, CORE20_MODULE_ID } from "./core20-audit.js";
import {
  createCore21SeedReplayAdapter,
  CORE21_MODULE_ID,
} from "./core21-seed-replay.js";
import {
  CORE_01_TO_18_CATALOG,
  registerCore01To18Adapters,
} from "./generic-public.js";

export {
  createAdapterRegistry,
  ADAPTER_REGISTRY_VERSION,
  defaultValidatePayload,
} from "./registry.js";
export {
  createCore19WorkflowAdapter,
  CORE19_MODULE_ID,
  CORE19_ADAPTER_VERSION,
} from "./core19-workflow.js";
export { createCore20AuditAdapter, CORE20_MODULE_ID } from "./core20-audit.js";
export {
  createCore21SeedReplayAdapter,
  CORE21_MODULE_ID,
} from "./core21-seed-replay.js";
export {
  CORE_01_TO_18_CATALOG,
  createGenericPublicAdapter,
  registerCore01To18Adapters,
} from "./generic-public.js";

/**
 * Create a default frozen-ready registry with CORE-01..21 adapters.
 * Caller may freeze after optional extra registrations.
 * @returns {ReturnType<typeof createAdapterRegistry>}
 */
export function createDefaultAdapterRegistry() {
  const registry = createAdapterRegistry();
  registerCore01To18Adapters(registry);
  registry.register(createCore19WorkflowAdapter());
  registry.register(createCore20AuditAdapter());
  registry.register(createCore21SeedReplayAdapter());
  return registry;
}

export const DEFAULT_MODULE_IDS = Object.freeze([
  ...CORE_01_TO_18_CATALOG.map((e) => e.moduleId),
  CORE19_MODULE_ID,
  CORE20_MODULE_ID,
  CORE21_MODULE_ID,
]);
