/**
 * Owner-path security boundary (A-SEC) and restricted-capability evidence hygiene.
 * Private Pairing remains a restricted capability for is_super_admin() sessions only.
 */

export const RESTRICTED_CAPABILITY_STRING_PATTERNS = Object.freeze([
  /\bA-PAIR\b/i,
  /pairing\.private_rules/i,
  /private_pairing/i,
  /private\s*pairing/i,
]);

export function textContainsRestrictedCapability(value) {
  const text = String(value ?? "");
  if (!text) return false;
  return RESTRICTED_CAPABILITY_STRING_PATTERNS.some((pattern) => pattern.test(text));
}

export function assertNoRestrictedCapabilityLeak(payload, label = "payload") {
  const serialized = JSON.stringify(payload ?? null);
  if (textContainsRestrictedCapability(serialized)) {
    throw new Error(`${label} leaks restricted capability strings`);
  }
}

/**
 * Deep-clone scrub for Owner UI/evidence export — removes keys/values that name
 * the restricted capability. Does not invent PASS/FAIL outcomes.
 */
export function scrubRestrictedCapabilityEvidence(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => scrubRestrictedCapabilityEvidence(entry))
      .filter((entry) => {
        if (typeof entry === "string") return !textContainsRestrictedCapability(entry);
        return true;
      });
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && textContainsRestrictedCapability(value)) {
      return "[redacted]";
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !textContainsRestrictedCapability(key))
      .map(([key, entry]) => [key, scrubRestrictedCapabilityEvidence(entry)])
      .filter(([, entry]) => entry !== "[redacted]")
  );
}

/**
 * A-SEC for Owner sessions (isSuperAdmin=false): confirm session is not
 * platform-wide admin. Never invokes restricted capability reads.
 */
export function evaluateOwnerSecurityBoundary({ isSuperAdmin } = {}) {
  if (isSuperAdmin) {
    return {
      ok: false,
      code: "UNEXPECTED_PLATFORM_ADMIN",
      message: "Owner security boundary requires non-platform-admin session",
    };
  }
  return {
    ok: true,
    code: "OK",
    details: {
      platformWideAdmin: false,
      sessionIsSuperAdmin: false,
      observed: "owner_session_lacks_platform_wide_admin",
    },
  };
}
