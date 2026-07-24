/**
 * Finance Platform Core adoption surface.
 * Import only from src/core/platform/index.js via the adapter module.
 */

export {
  FINANCE_PLATFORM_ADAPTER_ERROR,
  projectFinanceActor,
  projectFinanceTenantScope,
  projectFinanceSecurityContext,
  projectFinanceOperationIdentity,
  projectFinanceIdempotencyKey,
  projectFinanceContractVersion,
  projectFinanceCompatibilityDecision,
  projectFinanceEventEnvelope,
  projectFinanceErrorDescriptor,
  projectFinanceCapabilityDescriptor,
} from "./financePlatformAdapter.js";
