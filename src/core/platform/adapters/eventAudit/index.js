/**
 * Event / Audit adoption adapters (Platform Core).
 *
 * Pure projection helpers over already-resolved event and audit values.
 * Do not publish, persist, retry, redact, generate IDs/timestamps, or
 * access Identity/Tenant/Event runtimes.
 */

export {
  projectEventTraceContext,
  EVENT_TRACE_CONTEXT_ADAPTER_ERROR,
} from "./eventTraceContextAdapter.js";

export {
  projectCommonEventEnvelope,
  COMMON_EVENT_ENVELOPE_ADAPTER_ERROR,
} from "./commonEventEnvelopeAdapter.js";

export {
  projectAuditEventEnvelope,
  AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR,
} from "./auditEventEnvelopeAdapter.js";

export {
  projectEventErrorDescriptor,
  EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR,
} from "./eventErrorDescriptorAdapter.js";
