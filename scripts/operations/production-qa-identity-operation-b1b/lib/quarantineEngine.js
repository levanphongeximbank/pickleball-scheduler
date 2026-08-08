/**
 * Operation B1B quarantine engine.
 *
 * FIRST DURABLE WRITE = qa_quarantine_prepare (pending/pending)
 * Then Auth ban only if originally unbanned, with independent readbacks.
 * Activation via controlled writers only.
 * profiles.status is never a quarantine writer.
 *
 * Idempotency: use prepare response codes (already_quarantined /
 * prepare_idempotent / prepared). Do NOT call get_state before quarantine_id.
 *
 * Canonical authority: public.qa_identity_quarantines
 */

import {
  ACTIVE_AUTH_BAN_STATES,
  FAILURE_CLASSIFICATION_MATRIX,
  QUARANTINE_BAN_DURATION,
  SOURCE_OPERATION,
} from "./constants.js";
import { evaluateIdentityEligibility } from "./eligibility.js";
import { mutationAllowed } from "./authorization.js";
import { maskEmail, maskId } from "./masking.js";

function hardDeleteUnavailable() {
  return {
    available: false,
    reason: "hard_delete_not_permitted_for_operation_b1b",
  };
}

function extractAuthority(data) {
  if (!data) return null;
  if (data.row) return data.row;
  if (data.quarantine) return data.quarantine;
  if (data.lifecycle_state || data.lifecycleState) return data;
  if (data.data) return extractAuthority(data.data);
  return data;
}

function prepareCode(prepare) {
  return String(prepare?.data?.code || prepare?.code || "").toLowerCase();
}

function prepareQuarantineId(prepare, authority) {
  return (
    prepare?.data?.quarantine_id ||
    authority?.quarantine_id ||
    authority?.id ||
    null
  );
}

function prepareLifecycleVersion(prepare, authority) {
  const fromPrepare = prepare?.data?.lifecycle_version;
  if (fromPrepare != null) return Number(fromPrepare);
  if (authority?.lifecycle_version != null) {
    return Number(authority.lifecycle_version);
  }
  return 1;
}

function isFullyActive(authority) {
  if (!authority) return false;
  const life = String(authority.lifecycle_state || "").toLowerCase();
  const ban = String(authority.auth_ban_state || "").toLowerCase();
  return life === "active" && ACTIVE_AUTH_BAN_STATES.includes(ban);
}

function isPending(authority) {
  if (!authority) return false;
  return (
    String(authority.lifecycle_state || "").toLowerCase() === "pending" &&
    String(authority.auth_ban_state || "").toLowerCase() === "pending"
  );
}

async function independentAuthorityReadback(adapters, quarantineId) {
  if (!quarantineId) {
    return {
      ok: false,
      reason: "quarantine_id_required_for_get_state",
      authority: null,
    };
  }
  if (typeof adapters.qaQuarantineGetState !== "function") {
    return {
      ok: false,
      reason: "authority_readback_unavailable",
      authority: null,
    };
  }
  const res = await adapters.qaQuarantineGetState({ quarantineId });
  if (!res?.ok) {
    return {
      ok: false,
      reason: res?.reason || "authority_readback_failed",
      authority: null,
    };
  }
  return { ok: true, authority: extractAuthority(res.data), raw: res.data };
}

async function independentAuthReadback(adapters, authUserId) {
  if (typeof adapters.fetchAuthBanState !== "function") {
    return { ok: false, reason: "auth_readback_unavailable", banned: null };
  }
  const banned = await adapters.fetchAuthBanState(authUserId);
  if (banned !== true && banned !== false) {
    return { ok: false, reason: "auth_ban_state_unreadable", banned: null };
  }
  return { ok: true, banned };
}

async function verifyProfileStatusUnchanged(adapters, profileId, originalStatus) {
  if (typeof adapters.fetchProfile !== "function") {
    return { ok: false, reason: "profile_readback_unavailable" };
  }
  const profile = await adapters.fetchProfile(profileId);
  if (!profile) {
    return { ok: false, reason: "profile_missing_on_postcheck" };
  }
  if (String(profile.status ?? "") !== String(originalStatus ?? "")) {
    return {
      ok: false,
      reason: "profile_status_drift",
      current: profile.status,
    };
  }
  return { ok: true, status: profile.status };
}

async function recordCompensatedFailure(adapters, log, args) {
  const classification = args.failureClassification;
  const expectedTarget = FAILURE_CLASSIFICATION_MATRIX[classification];
  if (!expectedTarget) {
    return {
      ok: false,
      reason: `unknown_failure_classification:${classification}`,
    };
  }
  if (args.targetAuthBanState !== expectedTarget) {
    return {
      ok: false,
      reason: `invalid_compensation_pair:${classification}:${args.targetAuthBanState}`,
    };
  }
  if (typeof adapters.qaQuarantineRecordCompensatedFailure !== "function") {
    return { ok: false, reason: "failure_recorder_unavailable" };
  }
  const failRec = await adapters.qaQuarantineRecordCompensatedFailure({
    quarantineId: args.quarantineId,
    expectedLifecycleVersion: args.expectedLifecycleVersion,
    targetAuthBanState: args.targetAuthBanState,
    failureClassification: classification,
  });
  if (failRec?.ok) {
    log("qa_quarantine_record_compensated_failure", {
      classification,
      targetAuthBanState: args.targetAuthBanState,
    });
  }
  return failRec;
}

/**
 * Quarantine one identity via B1B authority writers.
 */
export async function quarantineOneIdentityB1B({
  allowlistRow,
  adapters,
  authResult,
  dryRun,
  batchId,
  allowlistSha256,
  snapshotSha256,
  reason = SOURCE_OPERATION,
  callLog = null,
}) {
  const log = (name, detail = {}) => {
    if (Array.isArray(callLog)) {
      callLog.push({ name, ...detail });
    }
  };

  const entry = {
    label: allowlistRow.label || null,
    auth_user_id: maskId(allowlistRow.auth_user_id),
    email: null,
    ok: false,
    dryRun: Boolean(dryRun),
    aborted: false,
    abortReason: null,
    critical: false,
    integrityIncident: false,
    original: null,
    authority: null,
    authBan: null,
    compensated: false,
    mutations: 0,
    callOrder: callLog || [],
    profileStatusPreserved: null,
  };

  if (hardDeleteUnavailable().available) {
    entry.aborted = true;
    entry.abortReason = "hard_delete_unexpectedly_available";
    return entry;
  }

  if (typeof adapters.updateProfileStatus === "function") {
    entry.aborted = true;
    entry.abortReason = "profile_status_writer_forbidden_on_b1b_surface";
    entry.critical = true;
    return entry;
  }

  const eligibility = await evaluateIdentityEligibility(allowlistRow, adapters);
  entry.email = eligibility.email ? maskEmail(eligibility.email) : null;
  if (!eligibility.ok) {
    entry.aborted = true;
    entry.abortReason = eligibility.reasons.join(",") || "ineligible";
    return entry;
  }

  const original = {
    profile_status: eligibility.profileStatus,
    auth_banned: eligibility.authBanned === true,
    email: eligibility.email,
    auth_user_id: allowlistRow.auth_user_id,
    profile_id: allowlistRow.profile_id,
  };
  entry.original = {
    profile_status: original.profile_status,
    auth_banned: original.auth_banned,
  };

  if (dryRun || !mutationAllowed(authResult)) {
    entry.authority = "dry_run_would_prepare_activate";
    entry.authBan = original.auth_banned
      ? "dry_run_preexisting_ban_unchanged"
      : "dry_run_would_ban";
    entry.ok = true;
    if (!dryRun && !mutationAllowed(authResult)) {
      entry.ok = false;
      entry.aborted = true;
      entry.abortReason = "mutation_not_authorized";
      entry.authority = "aborted_no_mutation";
      entry.authBan = "aborted_no_mutation";
    }
    return entry;
  }

  const profileId = allowlistRow.profile_id;
  const authUserId = allowlistRow.auth_user_id;

  // A) prepare — first durable write AND canonical idempotency resolver.
  // Do NOT call get_state before quarantine_id exists.
  if (typeof adapters.qaQuarantinePrepare !== "function") {
    entry.aborted = true;
    entry.abortReason = "prepare_writer_unavailable";
    return entry;
  }

  const prepare = await adapters.qaQuarantinePrepare({
    profileId,
    authUserId,
    batchId,
    allowlistSha256,
    snapshotSha256,
    reason,
    originalProfileStatus: original.profile_status,
    originalAuthBanned: original.auth_banned,
    expectedEmail: original.email,
    allowlistLabel: allowlistRow.label,
    metadata: { source_operation: SOURCE_OPERATION },
  });
  log("qa_quarantine_prepare", { code: prepareCode(prepare) || null });
  entry.mutations += 1;

  if (!prepare?.ok) {
    entry.aborted = true;
    entry.abortReason = prepare?.reason || "prepare_failed";
    entry.authority = "prepare_failed";
    entry.authBan = "no_auth_mutation";
    return entry;
  }

  const code = prepareCode(prepare);
  let authority = extractAuthority(prepare.data);
  const quarantineId = prepareQuarantineId(prepare, authority);
  let lifecycleVersion = prepareLifecycleVersion(prepare, authority);

  if (!quarantineId) {
    entry.aborted = true;
    entry.abortReason = "prepare_missing_quarantine_id";
    return entry;
  }

  // already_quarantined: same bind+batch fully active — verify via get_state(id)
  if (code === "already_quarantined" || isFullyActive(authority)) {
    const readback = await independentAuthorityReadback(adapters, quarantineId);
    log("authority_readback", { quarantineId });
    if (!readback.ok || !isFullyActive(readback.authority)) {
      entry.aborted = true;
      entry.abortReason =
        readback.reason || "already_quarantined_readback_failed";
      return entry;
    }
    authority = readback.authority;
    const profileCheck = await verifyProfileStatusUnchanged(
      adapters,
      profileId,
      original.profile_status
    );
    entry.profileStatusPreserved = profileCheck.ok === true;
    entry.authority = {
      lifecycle_state: authority.lifecycle_state,
      auth_ban_state: authority.auth_ban_state,
      lifecycle_version: authority.lifecycle_version,
    };
    entry.authBan = authority.auth_ban_state;
    entry.ok = profileCheck.ok === true;
    if (!entry.ok) {
      entry.aborted = true;
      entry.abortReason = profileCheck.reason || "postcheck_failed";
    }
    return entry;
  }

  // prepare_idempotent / prepared → pending path continues
  if (code === "prepare_idempotent" || code === "prepared" || isPending(authority)) {
    const pendingReadback = await independentAuthorityReadback(
      adapters,
      quarantineId
    );
    log("authority_readback_after_prepare", { quarantineId });
    if (pendingReadback.ok && pendingReadback.authority) {
      authority = pendingReadback.authority;
      lifecycleVersion = Number(
        authority.lifecycle_version ?? lifecycleVersion
      );
    }
    if (!isPending(authority) && !isFullyActive(authority)) {
      entry.aborted = true;
      entry.abortReason = "prepare_did_not_yield_pending";
      entry.authority = authority;
      return entry;
    }
    if (isFullyActive(authority)) {
      const profileCheck = await verifyProfileStatusUnchanged(
        adapters,
        profileId,
        original.profile_status
      );
      entry.profileStatusPreserved = profileCheck.ok === true;
      entry.authority = authority;
      entry.authBan = authority.auth_ban_state;
      entry.ok = profileCheck.ok === true;
      if (!entry.ok) {
        entry.aborted = true;
        entry.abortReason = profileCheck.reason;
      }
      return entry;
    }
  } else {
    entry.aborted = true;
    entry.abortReason = `unexpected_prepare_code:${code || "unknown"}`;
    return entry;
  }

  let b1bAppliedBan = false;

  // B/C) Auth ban path
  if (original.auth_banned === true) {
    const authRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback");
    if (!authRb.ok || authRb.banned !== true) {
      entry.aborted = true;
      entry.critical = true;
      entry.integrityIncident = true;
      entry.abortReason =
        authRb.banned === false
          ? "impossible_split_auth_unbanned_expected_preexisting"
          : authRb.reason || "auth_readback_failed";
      entry.authBan = "preexisting_readback_failed";
      return entry;
    }
    entry.authBan = "preexisting_confirmed";

    if (typeof adapters.qaQuarantineActivatePreexistingBan !== "function") {
      entry.aborted = true;
      entry.abortReason = "activate_preexisting_writer_unavailable";
      return entry;
    }

    const activate = await adapters.qaQuarantineActivatePreexistingBan({
      quarantineId,
      expectedLifecycleVersion: lifecycleVersion,
    });
    log("qa_quarantine_activate_preexisting_ban");
    entry.mutations += 1;

    if (!activate?.ok) {
      const failRec = await recordCompensatedFailure(adapters, log, {
        quarantineId,
        expectedLifecycleVersion: lifecycleVersion,
        targetAuthBanState: "failed",
        failureClassification: "activation_failed_preexisting",
      });
      if (failRec?.ok) {
        entry.mutations += 1;
        entry.compensated = true;
      }
      entry.aborted = true;
      entry.abortReason = activate?.reason || "activate_preexisting_failed";
      entry.authority = "activation_failed";
      entry.authBan = "preexisting_ban_left_unchanged";
      entry.ok = false;
      return entry;
    }

    const authReadbackFinal = await independentAuthorityReadback(
      adapters,
      quarantineId
    );
    log("authority_readback", { quarantineId });
    if (!authReadbackFinal.ok || !isFullyActive(authReadbackFinal.authority)) {
      return await compensatePostActivationFailure({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        authority: authReadbackFinal.authority || extractAuthority(activate.data),
        original,
        b1bAppliedBan: false,
        reason: "post_activation_authority_verify_failed",
      });
    }

    authority = authReadbackFinal.authority;
    if (
      String(authority.auth_ban_state) !== "not_required_preexisting" ||
      String(authority.lifecycle_state) !== "active"
    ) {
      return await compensatePostActivationFailure({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        authority,
        original,
        b1bAppliedBan: false,
        reason: "post_activation_state_mismatch",
      });
    }
  } else {
    if (typeof adapters.banAuthUser !== "function") {
      const failRec = await recordCompensatedFailure(adapters, log, {
        quarantineId,
        expectedLifecycleVersion: lifecycleVersion,
        targetAuthBanState: "failed",
        failureClassification: "auth_ban_failed",
      });
      if (failRec?.ok) {
        entry.mutations += 1;
        entry.compensated = true;
      }
      entry.aborted = true;
      entry.abortReason = "auth_ban_writer_unavailable";
      entry.authBan = "failed";
      return entry;
    }

    const banWrite = await adapters.banAuthUser({
      userId: authUserId,
      banDuration: QUARANTINE_BAN_DURATION,
      reason,
    });
    log("banAuthUser");
    entry.mutations += 1;

    if (!banWrite?.ok) {
      // BOUNDARY 2
      const failRec = await recordCompensatedFailure(adapters, log, {
        quarantineId,
        expectedLifecycleVersion: lifecycleVersion,
        targetAuthBanState: "failed",
        failureClassification: "auth_ban_failed",
      });
      if (failRec?.ok) {
        entry.mutations += 1;
        entry.compensated = true;
      }
      entry.aborted = true;
      entry.abortReason = banWrite?.reason || "auth_ban_failed";
      entry.authBan = "failed";
      entry.authority = "pending_failed_no_active";
      return entry;
    }

    b1bAppliedBan = true;
    entry.authBan = "banned_mutation_returned";

    const authRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback");
    if (!authRb.ok || authRb.banned !== true) {
      return await compensateActivationFailureAfterBan({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        lifecycleVersion,
        original,
        reason: authRb.reason || "auth_ban_readback_failed",
      });
    }
    entry.authBan = "banned_confirmed";

    if (typeof adapters.qaQuarantineActivateAfterAuthBan !== "function") {
      return await compensateActivationFailureAfterBan({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        lifecycleVersion,
        original,
        reason: "activate_after_auth_ban_writer_unavailable",
      });
    }

    const activate = await adapters.qaQuarantineActivateAfterAuthBan({
      quarantineId,
      expectedLifecycleVersion: lifecycleVersion,
      authBanReadbackConfirmed: true,
    });
    log("qa_quarantine_activate_after_auth_ban");
    entry.mutations += 1;

    if (!activate?.ok) {
      return await compensateActivationFailureAfterBan({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        lifecycleVersion,
        original,
        reason: activate?.reason || "activate_after_auth_ban_failed",
      });
    }

    const authReadbackFinal = await independentAuthorityReadback(
      adapters,
      quarantineId
    );
    log("authority_readback", { quarantineId });
    if (!authReadbackFinal.ok || !isFullyActive(authReadbackFinal.authority)) {
      return await compensatePostActivationFailure({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        authority:
          authReadbackFinal.authority || extractAuthority(activate.data),
        original,
        b1bAppliedBan: true,
        reason: "post_activation_authority_verify_failed",
      });
    }

    authority = authReadbackFinal.authority;
    if (
      String(authority.auth_ban_state) !== "applied" ||
      String(authority.lifecycle_state) !== "active"
    ) {
      return await compensatePostActivationFailure({
        entry,
        adapters,
        log,
        profileId,
        authUserId,
        quarantineId,
        authority,
        original,
        b1bAppliedBan: true,
        reason: "post_activation_state_mismatch",
      });
    }
  }

  const profileCheck = await verifyProfileStatusUnchanged(
    adapters,
    profileId,
    original.profile_status
  );
  entry.profileStatusPreserved = profileCheck.ok === true;
  if (!profileCheck.ok) {
    return await compensatePostActivationFailure({
      entry,
      adapters,
      log,
      profileId,
      authUserId,
      quarantineId,
      authority,
      original,
      b1bAppliedBan,
      reason: profileCheck.reason || "profile_status_drift",
    });
  }

  const finalAuth = await independentAuthReadback(adapters, authUserId);
  log("auth_readback_final");
  if (finalAuth.ok && finalAuth.banned === true && !isFullyActive(authority)) {
    entry.aborted = true;
    entry.critical = true;
    entry.integrityIncident = true;
    entry.abortReason = "impossible_split_auth_banned_without_authority";
    entry.ok = false;
    return entry;
  }

  entry.authority = {
    lifecycle_state: authority.lifecycle_state,
    auth_ban_state: authority.auth_ban_state,
    lifecycle_version: authority.lifecycle_version,
  };
  entry.ok = true;
  return entry;
}

async function compensateActivationFailureAfterBan({
  entry,
  adapters,
  log,
  profileId,
  authUserId,
  quarantineId,
  lifecycleVersion,
  original,
  reason,
}) {
  entry.aborted = true;
  entry.abortReason = reason;
  entry.authBan = "banned_activation_failed";

  let unbanProven = false;
  if (original.auth_banned === false) {
    if (typeof adapters.unbanAuthUser !== "function") {
      return await markCompensationIncomplete({
        entry,
        adapters,
        log,
        profileId,
        quarantineId,
        lifecycleVersion,
        original,
        detail: "unban_unavailable",
      });
    }
    const unban = await adapters.unbanAuthUser({ userId: authUserId });
    log("unbanAuthUser");
    entry.mutations += 1;
    if (!unban?.ok) {
      return await markCompensationIncomplete({
        entry,
        adapters,
        log,
        profileId,
        quarantineId,
        lifecycleVersion,
        original,
        detail: "unban_failed",
      });
    }
    const unbanRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback_after_unban");
    if (!unbanRb.ok || unbanRb.banned !== false) {
      return await markCompensationIncomplete({
        entry,
        adapters,
        log,
        profileId,
        quarantineId,
        lifecycleVersion,
        original,
        detail: "unban_readback_failed",
      });
    }
    entry.authBan = "unbanned_compensated";
    unbanProven = true;
  }

  if (!unbanProven && original.auth_banned === false) {
    return await markCompensationIncomplete({
      entry,
      adapters,
      log,
      profileId,
      quarantineId,
      lifecycleVersion,
      original,
      detail: "unban_not_proven",
    });
  }

  const failRec = await recordCompensatedFailure(adapters, log, {
    quarantineId,
    expectedLifecycleVersion: lifecycleVersion,
    targetAuthBanState: "reverted",
    failureClassification: "activation_failed_compensated",
  });
  entry.mutations += 1;
  if (!failRec?.ok) {
    return await markCompensationIncomplete({
      entry,
      adapters,
      log,
      profileId,
      quarantineId,
      lifecycleVersion: lifecycleVersion,
      original,
      detail: "failure_recording_failed",
      skipRecord: true,
    });
  }
  entry.compensated = true;

  const authCheck = await independentAuthorityReadback(adapters, quarantineId);
  log("authority_readback_after_compensation", { quarantineId });
  if (authCheck.ok && isFullyActive(authCheck.authority)) {
    entry.critical = true;
    entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:active_authority_remains";
    return entry;
  }

  const profileCheck = await verifyProfileStatusUnchanged(
    adapters,
    profileId,
    original.profile_status
  );
  entry.profileStatusPreserved = profileCheck.ok === true;
  entry.authority = "compensated_no_active";
  entry.ok = false;
  return entry;
}

async function markCompensationIncomplete({
  entry,
  adapters,
  log,
  profileId,
  quarantineId,
  lifecycleVersion,
  original,
  detail,
  skipRecord = false,
}) {
  entry.critical = true;
  entry.abortReason = `CRITICAL_COMPENSATION_INCOMPLETE:${detail}`;
  if (!skipRecord) {
    const failRec = await recordCompensatedFailure(adapters, log, {
      quarantineId,
      expectedLifecycleVersion: lifecycleVersion,
      targetAuthBanState: "failed",
      failureClassification: "compensation_incomplete",
    });
    if (failRec?.ok) {
      entry.mutations += 1;
      entry.compensated = true;
    }
  }
  const profileCheck = await verifyProfileStatusUnchanged(
    adapters,
    profileId,
    original.profile_status
  );
  entry.profileStatusPreserved = profileCheck.ok === true;
  entry.ok = false;
  return entry;
}

async function compensatePostActivationFailure({
  entry,
  adapters,
  log,
  profileId,
  authUserId,
  quarantineId,
  authority,
  original,
  b1bAppliedBan,
  reason,
}) {
  entry.aborted = true;
  entry.abortReason = reason;
  entry.critical = true;

  const lifecycleVersion = Number(authority?.lifecycle_version ?? 1);

  if (
    isFullyActive(authority) &&
    typeof adapters.qaQuarantineRelease === "function"
  ) {
    const release = await adapters.qaQuarantineRelease({
      quarantineId,
      expectedLifecycleVersion: lifecycleVersion,
      releaseReason: reason,
    });
    log("qa_quarantine_release");
    entry.mutations += 1;
    if (!release?.ok) {
      entry.abortReason = `CRITICAL_COMPENSATION_INCOMPLETE:release_failed:${reason}`;
      return entry;
    }
    entry.compensated = true;
  } else {
    const failRec = await recordCompensatedFailure(adapters, log, {
      quarantineId,
      expectedLifecycleVersion: lifecycleVersion,
      targetAuthBanState: b1bAppliedBan ? "reverted" : "failed",
      failureClassification: b1bAppliedBan
        ? "activation_failed_compensated"
        : original.auth_banned
          ? "activation_failed_preexisting"
          : "compensation_incomplete",
    });
    entry.mutations += 1;
    if (!failRec?.ok) {
      entry.abortReason = `CRITICAL_COMPENSATION_INCOMPLETE:failure_recording_failed:${reason}`;
      return entry;
    }
    entry.compensated = true;
  }

  if (b1bAppliedBan && original.auth_banned === false) {
    if (typeof adapters.unbanAuthUser !== "function") {
      entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:unban_unavailable";
      return entry;
    }
    const unban = await adapters.unbanAuthUser({ userId: authUserId });
    log("unbanAuthUser");
    entry.mutations += 1;
    if (!unban?.ok) {
      entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:unban_failed";
      return entry;
    }
    const unbanRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback_after_unban");
    if (!unbanRb.ok || unbanRb.banned !== false) {
      entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:unban_readback_failed";
      return entry;
    }
    entry.authBan = "unbanned_compensated";
  } else if (original.auth_banned === true) {
    entry.authBan = "preexisting_ban_left_unchanged";
  }

  const authCheck = await independentAuthorityReadback(adapters, quarantineId);
  log("authority_readback_after_compensation", { quarantineId });
  if (authCheck.ok && isFullyActive(authCheck.authority)) {
    entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:active_authority_remains";
    return entry;
  }

  const profileCheck = await verifyProfileStatusUnchanged(
    adapters,
    profileId,
    original.profile_status
  );
  entry.profileStatusPreserved = profileCheck.ok === true;
  entry.authority = "compensated_released_or_failed";
  entry.ok = false;
  return entry;
}

/**
 * Detect Auth banned without expected authority (BOUNDARY 5).
 * Requires an existing quarantineId when checking authority state.
 */
export async function detectImpossibleSplit(
  adapters,
  { authUserId, quarantineId }
) {
  const authRb = await independentAuthReadback(adapters, authUserId);
  if (!(authRb.ok && authRb.banned === true)) {
    return { incident: false };
  }
  if (!quarantineId) {
    return {
      incident: true,
      code: "impossible_split_auth_banned_without_authority",
      authBanned: true,
      authority: null,
    };
  }
  const authState = await independentAuthorityReadback(adapters, quarantineId);
  if (!authState.ok || !isFullyActive(authState.authority)) {
    const life = String(authState.authority?.lifecycle_state || "");
    if (life !== "pending") {
      return {
        incident: true,
        code: "impossible_split_auth_banned_without_authority",
        authBanned: true,
        authority: authState.authority,
      };
    }
  }
  return { incident: false };
}

export async function runBatchQuarantineB1B({
  identities,
  adapters,
  authResult,
  batchId,
  allowlistSha256,
  snapshotSha256,
}) {
  const effectiveDryRun = !mutationAllowed(authResult);
  const results = [];
  const batchCallLog = [];
  let stopAll = false;
  let integrityIncident = false;

  for (const row of identities) {
    if (stopAll) {
      results.push({
        label: row.label || null,
        ok: false,
        aborted: true,
        abortReason: "batch_stopped_after_integrity_incident",
        mutations: 0,
      });
      continue;
    }

    const oneCallLog = [];
    const one = await quarantineOneIdentityB1B({
      allowlistRow: row,
      adapters,
      authResult,
      dryRun: effectiveDryRun,
      batchId,
      allowlistSha256,
      snapshotSha256,
      callLog: oneCallLog,
    });
    batchCallLog.push(...oneCallLog.map((c) => ({ label: row.label, ...c })));
    results.push(one);

    if (one.integrityIncident || one.abortReason?.includes("impossible_split")) {
      integrityIncident = true;
      stopAll = true;
      continue;
    }

    if (one.critical || one.abortReason?.includes("CRITICAL_COMPENSATION_INCOMPLETE")) {
      integrityIncident = true;
      stopAll = true;
      continue;
    }

    if (!one.ok && !effectiveDryRun) {
      break;
    }
  }

  return {
    dryRun: effectiveDryRun,
    hardDelete: hardDeleteUnavailable(),
    results,
    callLog: batchCallLog,
    integrityIncident,
    ok:
      !integrityIncident &&
      results.length === identities.length &&
      results.every((r) => r.ok),
    mutationCalls: results.reduce((n, r) => n + (r.mutations || 0), 0),
    profileStatusWriterPresent: typeof adapters.updateProfileStatus === "function",
  };
}

export { hardDeleteUnavailable, isFullyActive, isPending };
