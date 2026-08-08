/**
 * Operation B1B quarantine engine.
 *
 * FIRST DURABLE WRITE = qa_quarantine_prepare (pending/pending)
 * Then Auth ban only if originally unbanned, with independent readbacks.
 * Activation via controlled writers only.
 * profiles.status is never a quarantine writer.
 *
 * Canonical authority: public.qa_identity_quarantines
 */

import {
  ACTIVE_AUTH_BAN_STATES,
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

async function independentAuthorityReadback(adapters, { profileId, quarantineId }) {
  if (typeof adapters.qaQuarantineGetState !== "function") {
    return { ok: false, reason: "authority_readback_unavailable", authority: null };
  }
  const res = await adapters.qaQuarantineGetState({ profileId, quarantineId });
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

  // Fail closed if profile status writer somehow appears.
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

  // Idempotency: already fully active for same batch → success after readback.
  const existing = await independentAuthorityReadback(adapters, {
    profileId,
    quarantineId: null,
  });
  log("authority_precheck_readback");
  if (existing.ok && isFullyActive(existing.authority)) {
    const authRow = existing.authority;
    if (
      String(authRow.batch_id || "") === String(batchId || "") &&
      String(authRow.allowlist_sha256 || "").toLowerCase() ===
        String(allowlistSha256 || "").toLowerCase()
    ) {
      const profileCheck = await verifyProfileStatusUnchanged(
        adapters,
        profileId,
        original.profile_status
      );
      entry.profileStatusPreserved = profileCheck.ok === true;
      entry.authority = "already_active_same_binding";
      entry.authBan = authRow.auth_ban_state;
      entry.ok = profileCheck.ok === true;
      if (!entry.ok) {
        entry.aborted = true;
        entry.abortReason = profileCheck.reason || "postcheck_failed";
      }
      return entry;
    }
  }

  // A) prepare — first durable write
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
  log("qa_quarantine_prepare");
  entry.mutations += 1;

  if (!prepare?.ok) {
    // BOUNDARY 1 — prepare fails before Auth ban
    entry.aborted = true;
    entry.abortReason = prepare?.reason || "prepare_failed";
    entry.authority = "prepare_failed";
    entry.authBan = "no_auth_mutation";
    return entry;
  }

  let authority = extractAuthority(prepare.data);
  const prepareReadback = await independentAuthorityReadback(adapters, {
    profileId,
    quarantineId: authority?.id || authority?.quarantine_id,
  });
  log("authority_readback_after_prepare");
  if (prepareReadback.ok && prepareReadback.authority) {
    authority = prepareReadback.authority;
  }

  if (!isPending(authority) && !isFullyActive(authority)) {
    // Unexpected state after prepare
    if (!isPending(authority)) {
      entry.aborted = true;
      entry.abortReason = "prepare_did_not_yield_pending";
      entry.authority = authority;
      return entry;
    }
  }

  // Already active same binding from prepare idempotent path
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

  const quarantineId = authority?.id || authority?.quarantine_id;
  let lifecycleVersion = Number(authority?.lifecycle_version ?? 1);
  let b1bAppliedBan = false;

  // B/C) Auth ban path
  if (original.auth_banned === true) {
    // Preexisting ban — do NOT mutate Auth
    const authRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback");
    if (!authRb.ok || authRb.banned !== true) {
      // BOUNDARY 5-ish / integrity: expected preexisting ban not confirmed
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
      // Activation failed; preexisting ban — no unban
      const failRec =
        typeof adapters.qaQuarantineRecordCompensatedFailure === "function"
          ? await adapters.qaQuarantineRecordCompensatedFailure({
              quarantineId,
              expectedLifecycleVersion: lifecycleVersion,
              targetAuthBanState: "not_required_preexisting",
              failureClassification: "activation_failed_preexisting",
            })
          : { ok: false };
      if (failRec?.ok) {
        log("qa_quarantine_record_compensated_failure");
        entry.mutations += 1;
        entry.compensated = true;
      }
      entry.aborted = true;
      entry.abortReason = activate?.reason || "activate_preexisting_failed";
      entry.authority = "activation_failed";
      return entry;
    }

    const authReadbackFinal = await independentAuthorityReadback(adapters, {
      profileId,
      quarantineId,
    });
    log("authority_readback");
    if (!authReadbackFinal.ok || !isFullyActive(authReadbackFinal.authority)) {
      // BOUNDARY 4
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
    // Originally unbanned — apply Auth ban
    if (typeof adapters.banAuthUser !== "function") {
      const failRec =
        typeof adapters.qaQuarantineRecordCompensatedFailure === "function"
          ? await adapters.qaQuarantineRecordCompensatedFailure({
              quarantineId,
              expectedLifecycleVersion: lifecycleVersion,
              targetAuthBanState: "failed",
              failureClassification: "auth_ban_writer_unavailable",
            })
          : { ok: false };
      if (failRec?.ok) {
        log("qa_quarantine_record_compensated_failure");
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
      // BOUNDARY 2 — prepare succeeded; Auth ban failed
      const failRec =
        typeof adapters.qaQuarantineRecordCompensatedFailure === "function"
          ? await adapters.qaQuarantineRecordCompensatedFailure({
              quarantineId,
              expectedLifecycleVersion: lifecycleVersion,
              targetAuthBanState: "failed",
              failureClassification: "auth_ban_failed",
            })
          : { ok: false };
      if (failRec?.ok) {
        log("qa_quarantine_record_compensated_failure");
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

    // C) Independent Auth readback — never trust ban mutation alone
    const authRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback");
    if (!authRb.ok || authRb.banned !== true) {
      // Ban claimed success but readback failed → compensate as BOUNDARY 3
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
      // BOUNDARY 3
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

    const authReadbackFinal = await independentAuthorityReadback(adapters, {
      profileId,
      quarantineId,
    });
    log("authority_readback");
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

  // Final profile status postcheck — must remain original
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

  // Detect impossible split: Auth banned without expected active authority
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

  // Deterministic unban because original was unbanned and B1B applied ban
  if (original.auth_banned === false) {
    if (typeof adapters.unbanAuthUser !== "function") {
      entry.critical = true;
      entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:unban_unavailable";
      return entry;
    }
    const unban = await adapters.unbanAuthUser({ userId: authUserId });
    log("unbanAuthUser");
    entry.mutations += 1;
    if (!unban?.ok) {
      entry.critical = true;
      entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:unban_failed";
      return entry;
    }
    const unbanRb = await independentAuthReadback(adapters, authUserId);
    log("auth_readback_after_unban");
    if (!unbanRb.ok || unbanRb.banned !== false) {
      entry.critical = true;
      entry.abortReason = "CRITICAL_COMPENSATION_INCOMPLETE:unban_readback_failed";
      return entry;
    }
    entry.authBan = "unbanned_compensated";
  }

  if (typeof adapters.qaQuarantineRecordCompensatedFailure !== "function") {
    entry.critical = true;
    entry.abortReason =
      "CRITICAL_COMPENSATION_INCOMPLETE:failure_recorder_unavailable";
    return entry;
  }

  const failRec = await adapters.qaQuarantineRecordCompensatedFailure({
    quarantineId,
    expectedLifecycleVersion: lifecycleVersion,
    targetAuthBanState: "reverted",
    failureClassification: reason,
  });
  log("qa_quarantine_record_compensated_failure");
  entry.mutations += 1;
  if (!failRec?.ok) {
    entry.critical = true;
    entry.abortReason =
      "CRITICAL_COMPENSATION_INCOMPLETE:failure_recording_failed";
    return entry;
  }
  entry.compensated = true;

  const authCheck = await independentAuthorityReadback(adapters, {
    profileId,
    quarantineId,
  });
  log("authority_readback_after_compensation");
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
  const authBanState = String(authority?.auth_ban_state || "");

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
  } else if (typeof adapters.qaQuarantineRecordCompensatedFailure === "function") {
    const failRec = await adapters.qaQuarantineRecordCompensatedFailure({
      quarantineId,
      expectedLifecycleVersion: lifecycleVersion,
      targetAuthBanState: b1bAppliedBan ? "reverted" : authBanState || "failed",
      failureClassification: reason,
    });
    log("qa_quarantine_record_compensated_failure");
    entry.mutations += 1;
    if (!failRec?.ok) {
      entry.abortReason = `CRITICAL_COMPENSATION_INCOMPLETE:failure_recording_failed:${reason}`;
      return entry;
    }
    entry.compensated = true;
  }

  // Unban only if B1B applied the ban and original was unbanned
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

  const authCheck = await independentAuthorityReadback(adapters, {
    profileId,
    quarantineId,
  });
  log("authority_readback_after_compensation");
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
 */
export async function detectImpossibleSplit(adapters, { profileId, authUserId }) {
  const authRb = await independentAuthReadback(adapters, authUserId);
  const authState = await independentAuthorityReadback(adapters, {
    profileId,
    quarantineId: null,
  });
  if (authRb.ok && authRb.banned === true) {
    if (!authState.ok || !isFullyActive(authState.authority)) {
      // Pending with ban also counts as unexpected if not expected pending path mid-flight
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

    if (!one.ok && !effectiveDryRun) {
      // Fail closed: stop after first unresolved live failure.
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
