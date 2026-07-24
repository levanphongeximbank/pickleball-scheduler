/**
 * Integration / Capability adoption adapters (Platform Core).
 *
 * Pure projection helpers over caller-supplied integration-port and platform
 * capability descriptor values. Do not implement ports, register runtimes,
 * execute capabilities, load modules, scan the filesystem, or mutate a
 * discovery registry.
 */

export {
  projectIntegrationPortDescriptor,
  INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR,
} from "./integrationPortDescriptorAdapter.js";

export {
  projectPlatformCapabilityDescriptor,
  PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR,
} from "./platformCapabilityDescriptorAdapter.js";
