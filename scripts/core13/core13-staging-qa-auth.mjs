/**
 * CORE-13 Staging QA identity/auth resolution — test/acceptance tooling only.
 *
 * EXISTING_QA_IDENTITY_MODE. No Auth/Identity/Tenant mutation.
 * No owner→referee fallback. No hardcoded passwords. No JWT minting.
 * Tokens are never logged or written to receipts.
 */

export const FIXTURE_BINDING_MODE = Object.freeze({
  EXISTING_QA_IDENTITY: "EXISTING_QA_IDENTITY_MODE",
  DISPOSABLE_IDENTITY_PROVISION: "DISPOSABLE_IDENTITY_PROVISION_MODE",
});

export const AUTH_CONTEXT_CLASS = Object.freeze({
  ORGANIZER: "ORGANIZER",
  REFEREE: "REFEREE",
});

const EXPLICIT_CREDENTIAL_KEYS = Object.freeze({
  organizerAEmail: "STAGING_OWNER_A_EMAIL",
  organizerACred: "STAGING_OWNER_A_PASSWORD",
  organizerBEmail: "STAGING_OWNER_B_EMAIL",
  organizerBCred: "STAGING_OWNER_B_PASSWORD",
  refereeAEmail: "STAGING_REFEREE_EMAIL",
  refereeACred: "STAGING_REFEREE_PASSWORD",
  replacementRefereeEmail: "STAGING_REPLACEMENT_REFEREE_EMAIL",
  inactiveRefereeEmail: "STAGING_INACTIVE_REFEREE_EMAIL",
});

function present(envMap, key) {
  return Boolean(String(envMap?.[key] || "").trim());
}

function proof(ok, detail, extra = {}) {
  return Object.freeze({ ok: ok === true, detail: String(detail || ""), ...extra });
}

export function readExplicitCredentialPresence(envMap = {}) {
  return Object.freeze({
    STAGING_OWNER_A_EMAIL: present(envMap, EXPLICIT_CREDENTIAL_KEYS.organizerAEmail),
    STAGING_OWNER_A_PASSWORD: present(envMap, EXPLICIT_CREDENTIAL_KEYS.organizerACred),
    STAGING_OWNER_B_EMAIL: present(envMap, EXPLICIT_CREDENTIAL_KEYS.organizerBEmail),
    STAGING_OWNER_B_PASSWORD: present(envMap, EXPLICIT_CREDENTIAL_KEYS.organizerBCred),
    STAGING_REFEREE_EMAIL: present(envMap, EXPLICIT_CREDENTIAL_KEYS.refereeAEmail),
    STAGING_REFEREE_PASSWORD: present(envMap, EXPLICIT_CREDENTIAL_KEYS.refereeACred),
    STAGING_REPLACEMENT_REFEREE_EMAIL: present(
      envMap,
      EXPLICIT_CREDENTIAL_KEYS.replacementRefereeEmail
    ),
    STAGING_INACTIVE_REFEREE_EMAIL: present(
      envMap,
      EXPLICIT_CREDENTIAL_KEYS.inactiveRefereeEmail
    ),
  });
}

export function evaluateOwnerToRefereeFallbackDenied(envMap = {}, options = {}) {
  const refereeEmail = String(envMap.STAGING_REFEREE_EMAIL || "").trim().toLowerCase();
  const ownerEmail = String(envMap.STAGING_OWNER_A_EMAIL || "").trim().toLowerCase();
  if (options.fallbackFromOwner === true) {
    return proof(false, "OWNER_TO_REFEREE_FALLBACK denied");
  }
  if (!refereeEmail) {
    return proof(false, "MISSING_EXISTING_QA_REFEREE_CREDENTIAL");
  }
  if (ownerEmail && refereeEmail === ownerEmail) {
    return proof(false, "OWNER_TO_REFEREE_FALLBACK denied");
  }
  return proof(true, "dedicated-referee-credential");
}

export function evaluateVenueAsTenantFallbackDenied(input = {}) {
  if (input.deriveTenantFromVenue === true || input.venueAsTenant === true) {
    return proof(false, "VENUE_AS_TENANT_FALLBACK denied");
  }
  const tenantId = String(input.tenantId || "").trim();
  const venueId = String(input.venueId || "").trim();
  if (!tenantId && venueId) {
    return proof(false, "VENUE_AS_TENANT_FALLBACK denied");
  }
  return proof(true, "tenant-resolved-independently");
}

export function sanitizeAuthContext(context = {}) {
  const rest = { ...(context || {}) };
  delete rest.accessToken;
  delete rest.password;
  delete rest.refreshToken;
  return Object.freeze({
    userId: String(rest.userId || "").trim() || null,
    tenantId: String(rest.tenantId || "").trim() || null,
    venueId: String(rest.venueId || "").trim() || null,
    role: String(rest.role || "").trim() || null,
    status: String(rest.status || "").trim() || null,
    class: rest.class || null,
    emailPresent: Boolean(String(rest.email || "").trim()),
  });
}

export function evaluateOrganizerAuthContext(context = {}) {
  if (!context?.accessToken) {
    return proof(false, "missing organizer context");
  }
  if (!context.userId || !context.tenantId) {
    return proof(false, "organizer userId/tenantId required");
  }
  const venueCheck = evaluateVenueAsTenantFallbackDenied(context);
  if (!venueCheck.ok) return venueCheck;
  return proof(true, "organizer-context", { class: AUTH_CONTEXT_CLASS.ORGANIZER });
}

export function evaluateRefereeAuthContext(refereeContext = {}, organizerContext = {}) {
  if (refereeContext?.fallbackFromOwner === true) {
    return proof(false, "OWNER_TO_REFEREE_FALLBACK denied");
  }
  if (!refereeContext?.accessToken) {
    return proof(false, "MISSING_EXISTING_QA_REFEREE_CREDENTIAL");
  }
  if (!refereeContext.userId || !refereeContext.tenantId) {
    return proof(false, "referee userId/tenantId required");
  }
  const role = String(refereeContext.role || "").toUpperCase();
  if (role !== "REFEREE") {
    return proof(false, "ORGANIZER_AS_REFEREE_IMPERSONATION denied");
  }
  if (
    organizerContext?.userId &&
    String(refereeContext.userId) === String(organizerContext.userId)
  ) {
    return proof(false, "ORGANIZER_AS_REFEREE_IMPERSONATION denied");
  }
  const venueCheck = evaluateVenueAsTenantFallbackDenied(refereeContext);
  if (!venueCheck.ok) return venueCheck;
  return proof(true, "referee-context", { class: AUTH_CONTEXT_CLASS.REFEREE });
}

/**
 * CORE-13 inactive-referee fixture acceptance.
 *
 * Authority is Contract #01 evidence.active === false.
 * Literal status "INACTIVE" is not required and is not a canonical Identity status.
 * Canonical SUSPENDED + active=false is valid dedicated-fixture evidence.
 *
 * INVITED also yields Contract #01 active=false, but INVITED is pre-activation
 * onboarding, not the retained CORE-13 negative fixture (PR #449 SUSPENDED REFEREE).
 *
 * Expected dedicated fixture:
 *   role=REFEREE, status=suspended, active=false,
 *   tenantId=venue-staging-a, venueId=null
 */
export const INACTIVE_REFEREE_ACCEPTANCE_RULE = Object.freeze({
  authority: "CONTRACT_01_EVIDENCE_ACTIVE_FALSE",
  literalInactiveRequired: false,
  dedicatedFixtureStatus: "suspended",
  dedicatedFixtureRole: "REFEREE",
  invitedNotDedicatedFixture: true,
});

function readContract01Evidence(subject = {}) {
  const evidence = subject?.contract01Evidence || subject?.evidence || null;
  if (!evidence || typeof evidence !== "object") return null;
  return evidence;
}

function subjectIdOf(subject = {}) {
  return String(subject.userId || subject.id || subject.subjectId || "").trim();
}

/**
 * Qualify an inactive-referee fixture from Contract #01 evidence only.
 * Caller/local status/active/role/tenant cannot override canonical evidence.
 */
export function evaluateInactiveRefereeFixture(inactive = {}, options = {}) {
  const localId = subjectIdOf(inactive);
  const evidence = readContract01Evidence(inactive);
  if (!localId && !evidence?.subjectId && !evidence?.canonicalSubjectId) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE"],
    });
  }
  if (!evidence) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_CONTRACT_01_EVIDENCE_MISSING", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_CONTRACT_01_EVIDENCE_MISSING"],
    });
  }

  const evidenceId = String(evidence.subjectId || evidence.canonicalSubjectId || "").trim();
  if (!evidenceId) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_CONTRACT_01_EVIDENCE_MISSING", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_CONTRACT_01_EVIDENCE_MISSING"],
    });
  }
  if (localId && localId !== evidenceId) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_SUBJECT_MISMATCH", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_SUBJECT_MISMATCH"],
    });
  }

  const role = String(evidence.role || "").trim().toUpperCase();
  if (role !== INACTIVE_REFEREE_ACCEPTANCE_RULE.dedicatedFixtureRole) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE"],
    });
  }

  const requiredTenantId = String(options.requiredTenantId || "").trim();
  const evidenceTenantId = String(evidence.tenantId || "").trim();
  if (requiredTenantId && evidenceTenantId !== requiredTenantId) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_TENANT", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_TENANT"],
    });
  }

  if (evidence.active !== false) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_ACTIVE_NOT_FALSE", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_ACTIVE_NOT_FALSE"],
    });
  }

  const status = String(evidence.status || "").trim().toLowerCase();
  if (status === "invited") {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_INVITED_NOT_DEDICATED", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_INVITED_NOT_DEDICATED"],
    });
  }
  if (status !== INACTIVE_REFEREE_ACCEPTANCE_RULE.dedicatedFixtureStatus) {
    return proof(false, "EXISTING_QA_INACTIVE_REFEREE_NOT_DEDICATED_SUSPENDED", {
      missing: ["EXISTING_QA_INACTIVE_REFEREE_NOT_DEDICATED_SUSPENDED"],
    });
  }

  return proof(true, "SUSPENDED / CONTRACT_01_ACTIVE_FALSE", {
    INACTIVE_REFEREE_EVIDENCE: "SUSPENDED / CONTRACT_01_ACTIVE_FALSE",
    status,
    active: false,
    role,
    tenantId: evidenceTenantId || null,
    venueId: evidence.venueId == null || evidence.venueId === "" ? null : String(evidence.venueId),
  });
}

/**
 * Qualify an active referee fixture from Contract #01 evidence only.
 * Fixture-local role/status/tenant/active cannot override canonical evidence.
 */
export function evaluateActiveRefereeContract01Fixture(subject = {}, options = {}) {
  const label = String(options.label || "EXISTING_QA_REFEREE").trim();
  const localId = subjectIdOf(subject);
  const evidence = readContract01Evidence(subject);
  if (!localId && !evidence?.subjectId && !evidence?.canonicalSubjectId) {
    return proof(false, `${label}_CONTRACT_01_EVIDENCE_MISSING`, {
      missing: [`${label}_CONTRACT_01_EVIDENCE_MISSING`],
    });
  }
  if (!evidence) {
    return proof(false, `${label}_CONTRACT_01_EVIDENCE_MISSING`, {
      missing: [`${label}_CONTRACT_01_EVIDENCE_MISSING`],
    });
  }

  const evidenceId = String(evidence.subjectId || evidence.canonicalSubjectId || "").trim();
  if (!evidenceId) {
    return proof(false, `${label}_CONTRACT_01_EVIDENCE_MISSING`, {
      missing: [`${label}_CONTRACT_01_EVIDENCE_MISSING`],
    });
  }
  if (localId && localId !== evidenceId) {
    return proof(false, `${label}_SUBJECT_MISMATCH`, {
      missing: [`${label}_SUBJECT_MISMATCH`],
    });
  }

  const role = String(evidence.role || "").trim().toUpperCase();
  if (role !== "REFEREE") {
    return proof(false, `${label}_ROLE`, { missing: [`${label}_ROLE`] });
  }

  const requiredTenantId = String(options.requiredTenantId || subject.tenantId || "").trim();
  const evidenceTenantId = String(evidence.tenantId || "").trim();
  if (requiredTenantId && evidenceTenantId !== requiredTenantId) {
    return proof(false, `${label}_TENANT`, { missing: [`${label}_TENANT`] });
  }
  if (!evidenceTenantId) {
    return proof(false, `${label}_MISSING_TENANT_EVIDENCE`, {
      missing: [`${label}_MISSING_TENANT_EVIDENCE`],
    });
  }

  const status = String(evidence.status || "").trim().toLowerCase();
  if (status !== "active") {
    return proof(false, `${label}_NOT_ACTIVE`, { missing: [`${label}_NOT_ACTIVE`] });
  }
  if (evidence.active !== true) {
    return proof(false, `${label}_ACTIVE_NOT_TRUE`, {
      missing: [`${label}_ACTIVE_NOT_TRUE`],
    });
  }

  return proof(true, "CONTRACT_01_ACTIVE_REFEREE", {
    role,
    status,
    active: true,
    tenantId: evidenceTenantId,
    venueId: evidence.venueId == null || evidence.venueId === "" ? null : String(evidence.venueId),
    contract01Evidence: evidence,
  });
}

export function evaluateExistingQaIdentitySet(input = {}) {
  const organizerA = input.organizerA || null;
  const organizerB = input.organizerB || null;
  const refereeA = input.refereeA || null;
  const replacement = input.replacementReferee || null;
  const inactive = input.inactiveReferee || null;
  const missing = [];
  if (!organizerA?.userId || !organizerA?.tenantId) missing.push("EXISTING_QA_ORGANIZER_A");
  if (!organizerB?.userId || !organizerB?.tenantId) missing.push("EXISTING_QA_ORGANIZER_B");
  if (organizerA?.tenantId && organizerB?.tenantId && organizerA.tenantId === organizerB.tenantId) {
    return proof(false, "TENANT_A and TENANT_B must be distinct canonical tenants", {
      EXISTING_QA_IDENTITY_SET_READY: false,
    });
  }
  const requiredTenantId = organizerA?.tenantId || "";
  const refereeAProof = evaluateActiveRefereeContract01Fixture(refereeA, {
    label: "EXISTING_QA_REFEREE_A",
    requiredTenantId,
  });
  if (!refereeAProof.ok) {
    missing.push(...(refereeAProof.missing || [refereeAProof.detail]));
  }
  if (!refereeA?.credentialPresent) missing.push("MISSING_EXISTING_QA_REFEREE_CREDENTIAL");
  const replacementProof = evaluateActiveRefereeContract01Fixture(replacement, {
    label: "EXISTING_QA_REPLACEMENT_REFEREE",
    requiredTenantId,
  });
  if (!replacementProof.ok) {
    missing.push(...(replacementProof.missing || [replacementProof.detail]));
  }
  const inactiveProof = evaluateInactiveRefereeFixture(inactive, {
    requiredTenantId: organizerA?.tenantId || "",
  });
  if (!inactiveProof.ok) {
    missing.push(...(inactiveProof.missing || [inactiveProof.detail]));
  }
  if (missing.length) {
    return proof(false, missing.join(","), {
      EXISTING_QA_IDENTITY_SET_READY: false,
      missing,
    });
  }
  const tok = refereeA.accessToken || (refereeA.credentialPresent ? "ok" : "");
  const impersonation = evaluateRefereeAuthContext(
    {
      ...refereeA,
      role: "REFEREE",
      accessToken: tok,
    },
    organizerA
  );
  if (!impersonation.ok) return { ...impersonation, EXISTING_QA_IDENTITY_SET_READY: false };
  return proof(true, "existing-qa-identity-set", {
    EXISTING_QA_IDENTITY_SET_READY: true,
    INACTIVE_REFEREE_EVIDENCE: inactiveProof.INACTIVE_REFEREE_EVIDENCE,
  });
}

export function evaluateExistingQaEnvReadiness(envMap = {}) {
  const presence = readExplicitCredentialPresence(envMap);
  const missing = [];
  if (!presence.STAGING_OWNER_A_EMAIL || !presence.STAGING_OWNER_A_PASSWORD) {
    missing.push("EXISTING_QA_ORGANIZER_A");
  }
  if (!presence.STAGING_OWNER_B_EMAIL || !presence.STAGING_OWNER_B_PASSWORD) {
    missing.push("EXISTING_QA_ORGANIZER_B");
  }
  const referee = evaluateOwnerToRefereeFallbackDenied(envMap);
  if (!referee.ok) missing.push(referee.detail);
  if (!presence.STAGING_REFEREE_PASSWORD) missing.push("MISSING_EXISTING_QA_REFEREE_CREDENTIAL");
  if (!presence.STAGING_INACTIVE_REFEREE_EMAIL) missing.push("EXISTING_QA_INACTIVE_REFEREE");
  if (missing.length) {
    return proof(false, missing.join(","), {
      EXISTING_QA_IDENTITY_SET_READY: false,
      presence,
      missing,
    });
  }
  return proof(true, "existing-qa-env-ready", { presence, EXISTING_QA_IDENTITY_SET_READY: true });
}

export { EXPLICIT_CREDENTIAL_KEYS };
