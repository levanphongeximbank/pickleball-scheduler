/**
 * Reversible quarantine engine for Operation B1.
 *
 * Uses existing canonical mechanisms only:
 *   - profiles.status = 'quarantined'
 *   - Auth admin ban_duration (same as prod-smoke-identity-hygiene)
 *
 * Order (execute):
 *   1) capture original state
 *   2) re-verify eligibility
 *   3) apply profile status quarantine
 *   4) verify profile state
 *   5) apply Auth ban
 *   6) if Auth ban fails → compensate by restoring profile status
 *   7) stop on first unresolved failure
 *
 * Hard delete is unavailable.
 */

import {
  QUARANTINE_BAN_DURATION,
  QUARANTINE_PROFILE_STATUS,
} from "./constants.js";
import { evaluateIdentityEligibility } from "./eligibility.js";
import { mutationAllowed } from "./authorization.js";
import { maskEmail, maskId } from "./masking.js";

function hardDeleteUnavailable() {
  return {
    available: false,
    reason: "hard_delete_not_permitted_for_operation_b1",
  };
}

/**
 * Apply reversible quarantine for one identity with compensation.
 */
export async function quarantineOneIdentity({
  allowlistRow,
  adapters,
  authResult,
  dryRun,
  reason = "operation-b1-reversible-qa-quarantine",
}) {
  const entry = {
    label: allowlistRow.label || null,
    auth_user_id: maskId(allowlistRow.auth_user_id),
    email: null,
    ok: false,
    dryRun: Boolean(dryRun),
    aborted: false,
    abortReason: null,
    original: null,
    profile: null,
    ban: null,
    compensated: false,
    mutations: 0,
  };

  if (hardDeleteUnavailable().available) {
    entry.aborted = true;
    entry.abortReason = "hard_delete_unexpectedly_available";
    return entry;
  }

  const eligibility = await evaluateIdentityEligibility(allowlistRow, adapters);
  entry.email = eligibility.email ? maskEmail(eligibility.email) : null;
  if (!eligibility.ok) {
    entry.aborted = true;
    entry.abortReason = eligibility.reasons.join(",") || "ineligible";
    entry.profile = "aborted_no_mutation";
    entry.ban = "aborted_no_mutation";
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
    entry.profile = "dry_run_would_quarantine";
    entry.ban = "dry_run_would_ban";
    entry.ok = true;
    entry.aborted = !dryRun && !mutationAllowed(authResult);
    if (entry.aborted) {
      entry.abortReason = "mutation_not_authorized";
      entry.profile = "aborted_no_mutation";
      entry.ban = "aborted_no_mutation";
      entry.ok = false;
    }
    return entry;
  }

  // Idempotent: already quarantined + banned → success without extra writes when matching.
  const alreadyProfile =
    String(original.profile_status || "").toLowerCase() ===
    QUARANTINE_PROFILE_STATUS;
  const alreadyBanned = original.auth_banned === true;

  // 1) Profile status
  if (!alreadyProfile) {
    if (typeof adapters.updateProfileStatus !== "function") {
      entry.aborted = true;
      entry.abortReason = "profile_writer_unavailable";
      entry.profile = "aborted_no_mutation";
      entry.ban = "aborted_no_mutation";
      return entry;
    }
    const profileWrite = await adapters.updateProfileStatus({
      profileId: allowlistRow.profile_id,
      email: eligibility.email,
      status: QUARANTINE_PROFILE_STATUS,
      expectedCurrentStatus: original.profile_status,
    });
    if (!profileWrite?.ok) {
      entry.aborted = true;
      entry.abortReason = profileWrite?.reason || "profile_update_failed";
      entry.profile = "failed";
      entry.ban = "skipped_after_profile_failure";
      return entry;
    }
    entry.profile = "quarantined";
    entry.mutations += 1;
  } else {
    entry.profile = "already_quarantined";
  }

  // 2) Auth ban
  if (!alreadyBanned) {
    if (typeof adapters.banAuthUser !== "function") {
      // Compensate profile change if we just applied it.
      if (entry.mutations > 0 && typeof adapters.updateProfileStatus === "function") {
        await adapters.updateProfileStatus({
          profileId: allowlistRow.profile_id,
          email: eligibility.email,
          status: original.profile_status,
          expectedCurrentStatus: QUARANTINE_PROFILE_STATUS,
          compensation: true,
        });
        entry.compensated = true;
        entry.mutations += 1;
      }
      entry.aborted = true;
      entry.abortReason = "auth_ban_writer_unavailable";
      entry.ban = "failed_compensated";
      return entry;
    }

    const banWrite = await adapters.banAuthUser({
      userId: allowlistRow.auth_user_id,
      banDuration: QUARANTINE_BAN_DURATION,
      reason,
    });
    if (!banWrite?.ok) {
      if (entry.profile === "quarantined" && typeof adapters.updateProfileStatus === "function") {
        await adapters.updateProfileStatus({
          profileId: allowlistRow.profile_id,
          email: eligibility.email,
          status: original.profile_status,
          expectedCurrentStatus: QUARANTINE_PROFILE_STATUS,
          compensation: true,
        });
        entry.compensated = true;
        entry.mutations += 1;
      }
      entry.aborted = true;
      entry.abortReason = banWrite?.reason || "auth_ban_failed";
      entry.ban = entry.compensated ? "failed_compensated" : "failed";
      return entry;
    }
    entry.ban = "banned";
    entry.mutations += 1;
  } else {
    entry.ban = "already_banned";
  }

  entry.ok = true;
  return entry;
}

/**
 * Unquarantine / rollback one identity using original batch snapshot values.
 * Refuses if current state drifted from expected post-quarantine state.
 */
export async function unquarantineOneIdentity({
  snapshotRow,
  adapters,
  authResult,
  dryRun,
}) {
  const entry = {
    label: snapshotRow.label || null,
    auth_user_id: maskId(snapshotRow.auth_user_id),
    ok: false,
    dryRun: Boolean(dryRun),
    aborted: false,
    abortReason: null,
    profile: null,
    ban: null,
    mutations: 0,
  };

  const profileId = String(snapshotRow.profile_id || "").trim();
  const authUserId = String(snapshotRow.auth_user_id || "").trim();
  const originalStatus = snapshotRow.original_profile_status;
  const originalBanned = snapshotRow.original_auth_banned === true;

  if (typeof adapters.fetchProfile !== "function") {
    entry.aborted = true;
    entry.abortReason = "profile_lookup_unavailable";
    return entry;
  }
  const live = await adapters.fetchProfile(profileId);
  if (!live) {
    entry.aborted = true;
    entry.abortReason = "profile_missing";
    return entry;
  }

  const liveStatus = String(live.status || "");
  // Drift guard: profile must be quarantined (restorable) or already original.
  if (
    liveStatus.toLowerCase() !== QUARANTINE_PROFILE_STATUS &&
    liveStatus !== String(originalStatus ?? "")
  ) {
    entry.aborted = true;
    entry.abortReason = "post_quarantine_profile_drift";
    return entry;
  }

  let liveBanned = null;
  if (typeof adapters.fetchAuthBanState === "function") {
    liveBanned = await adapters.fetchAuthBanState(authUserId);
    if (liveBanned !== true && liveBanned !== false) {
      entry.aborted = true;
      entry.abortReason = "auth_ban_state_unreadable";
      return entry;
    }
  }

  if (dryRun || !mutationAllowed(authResult)) {
    entry.profile = "dry_run_would_restore_profile";
    entry.ban = "dry_run_would_restore_auth";
    entry.ok = true;
    if (!dryRun && !mutationAllowed(authResult)) {
      entry.ok = false;
      entry.aborted = true;
      entry.abortReason = "mutation_not_authorized";
      entry.profile = "aborted_no_mutation";
      entry.ban = "aborted_no_mutation";
    }
    return entry;
  }

  // Restore profile if still quarantined
  if (liveStatus.toLowerCase() === QUARANTINE_PROFILE_STATUS) {
    const restored = await adapters.updateProfileStatus({
      profileId,
      email: snapshotRow.email || live.email,
      status: originalStatus,
      expectedCurrentStatus: QUARANTINE_PROFILE_STATUS,
    });
    if (!restored?.ok) {
      entry.aborted = true;
      entry.abortReason = restored?.reason || "profile_restore_failed";
      entry.profile = "failed";
      return entry;
    }
    entry.profile = "restored";
    entry.mutations += 1;
  } else {
    entry.profile = "already_restored";
  }

  // Restore Auth ban if currently banned and original was not
  if (liveBanned === true && originalBanned === false) {
    if (typeof adapters.unbanAuthUser !== "function") {
      entry.aborted = true;
      entry.abortReason = "auth_unban_writer_unavailable";
      entry.ban = "failed";
      return entry;
    }
    const unban = await adapters.unbanAuthUser({ userId: authUserId });
    if (!unban?.ok) {
      entry.aborted = true;
      entry.abortReason = unban?.reason || "auth_unban_failed";
      entry.ban = "failed";
      return entry;
    }
    entry.ban = "unbanned";
    entry.mutations += 1;
  } else if (liveBanned === false && originalBanned === false) {
    entry.ban = "already_unbanned";
  } else if (originalBanned === true) {
    entry.ban = "original_was_banned_left_unchanged";
  } else {
    entry.ban = "noop";
  }

  entry.ok = !entry.aborted;
  return entry;
}

export async function runBatchQuarantine({
  identities,
  adapters,
  authResult,
}) {
  // Authorized mutation only when Owner GO exact; otherwise dry-run behavior.
  const effectiveDryRun = !mutationAllowed(authResult);
  const results = [];
  for (const row of identities) {
    const one = await quarantineOneIdentity({
      allowlistRow: row,
      adapters,
      authResult,
      dryRun: effectiveDryRun,
    });
    results.push(one);
    if (!one.ok && !effectiveDryRun) {
      // Fail closed: stop after first unresolved live failure.
      break;
    }
  }
  return {
    dryRun: effectiveDryRun,
    hardDelete: hardDeleteUnavailable(),
    results,
    ok: results.length === identities.length && results.every((r) => r.ok),
    mutationCalls: results.reduce((n, r) => n + (r.mutations || 0), 0),
  };
}

export { hardDeleteUnavailable };
