/**
 * Shared Production smoke identity hygiene.
 * Prefer quarantine over hard-delete. Domains must remain recognizable by
 * src/features/player/utils/qaTestIdentityFilter.js.
 *
 * SAFETY: Auth user ID alone is never sufficient. Before any profile update
 * or Auth ban, the target email must pass isCertifiedQaEmail().
 */
import {
  APPROVED_QA_EMAIL_DOMAINS,
  isCertifiedQaEmail,
} from "../../src/features/player/utils/qaTestIdentityFilter.js";

export { APPROVED_QA_EMAIL_DOMAINS, isCertifiedQaEmail };

export const PROD_QA_EMAIL_DOMAINS = APPROVED_QA_EMAIL_DOMAINS;

/** @deprecated Use isCertifiedQaEmail — domain alone is insufficient. */
export function isProdQaSmokeEmail(email) {
  return isCertifiedQaEmail(email);
}

/**
 * Resolve Auth user email from admin client or optional override.
 * @param {{ admin?: any, userId: string, emailOverride?: string|null }} input
 * @returns {Promise<{ ok: boolean, email: string|null, reason?: string }>}
 */
export async function resolveAuthUserEmailForQuarantine(input = {}) {
  const override = input.emailOverride;
  if (override != null && String(override).trim()) {
    return { ok: true, email: String(override).trim().toLowerCase() };
  }
  const admin = input.admin;
  const userId = String(input.userId || "").trim();
  if (!userId) {
    return { ok: false, email: null, reason: "missing_user_id" };
  }
  if (!admin?.auth?.admin?.getUserById) {
    return { ok: false, email: null, reason: "auth_lookup_unavailable" };
  }
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      return { ok: false, email: null, reason: String(error.message || error) };
    }
    const email = data?.user?.email ? String(data.user.email).trim().toLowerCase() : null;
    if (!email) {
      return { ok: false, email: null, reason: "email_absent" };
    }
    return { ok: true, email };
  } catch (err) {
    return { ok: false, email: null, reason: String(err?.message || err) };
  }
}

/**
 * Reversible quarantine for ephemeral Production smoke actors.
 * Does not hard-delete Auth users by default.
 * Auth ban and profile update are aborted when email is not a certified QA identity.
 *
 * @param {{
 *   admin?: any,
 *   managementSql?: Function,
 *   token?: string,
 *   userIds: string[],
 *   reason?: string,
 *   dryRun?: boolean,
 *   emailOverrides?: Record<string, string>,
 * }} input
 */
export async function quarantineProductionSmokeUsers(input = {}) {
  const admin = input.admin;
  const userIds = (input.userIds || []).map(String).filter(Boolean);
  const reason = String(input.reason || "production-smoke-quarantine");
  const dryRun = input.dryRun === true;
  const emailOverrides = input.emailOverrides || {};
  const results = [];

  for (const userId of userIds) {
    const entry = {
      userId,
      email: null,
      certified: false,
      aborted: false,
      abortReason: null,
      dryRun,
      profile: null,
      ban: null,
      mutations: 0,
    };

    const resolved = await resolveAuthUserEmailForQuarantine({
      admin,
      userId,
      emailOverride: emailOverrides[userId],
    });
    entry.email = resolved.email;

    if (!resolved.ok || !resolved.email) {
      entry.aborted = true;
      entry.abortReason = resolved.reason || "email_absent";
      entry.profile = "aborted_no_mutation";
      entry.ban = "aborted_no_mutation";
      results.push(entry);
      continue;
    }

    if (!isCertifiedQaEmail(resolved.email)) {
      entry.aborted = true;
      entry.abortReason = "email_not_certified_qa";
      entry.profile = "aborted_no_mutation";
      entry.ban = "aborted_no_mutation";
      results.push(entry);
      continue;
    }

    entry.certified = true;

    if (dryRun) {
      entry.profile = "dry_run_would_quarantine";
      entry.ban = "dry_run_would_ban";
      results.push(entry);
      continue;
    }

    try {
      if (typeof input.managementSql === "function" && input.token) {
        const emailEscaped = resolved.email.replace(/'/g, "''");
        await input.managementSql(
          input.token,
          `
update public.profiles
set status = 'quarantined',
    updated_at = now()
where id = '${userId}'::uuid
  and lower(btrim(email)) = '${emailEscaped}';
`,
          `quarantine-profile-${userId.slice(0, 8)}`
        );
        entry.profile = "quarantined";
        entry.mutations += 1;
      } else if (admin?.from) {
        const { error } = await admin
          .from("profiles")
          .update({ status: "quarantined" })
          .eq("id", userId)
          .eq("email", resolved.email);
        entry.profile = error ? error.message : "quarantined";
        if (!error) entry.mutations += 1;
      } else {
        entry.profile = "skipped_no_profile_writer";
      }
    } catch (err) {
      entry.profile = String(err?.message || err);
    }

    try {
      if (admin?.auth?.admin?.updateUserById) {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
          user_metadata: { qa_quarantine_reason: reason },
        });
        entry.ban = error ? error.message : "banned";
        if (!error) entry.mutations += 1;
      } else {
        entry.ban = "skipped_no_auth_admin";
      }
    } catch (err) {
      entry.ban = String(err?.message || err);
    }

    results.push(entry);
  }

  return results;
}
