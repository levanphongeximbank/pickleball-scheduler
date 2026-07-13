import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

let testClientOverride = null;

export function __setRatingV5RolloutClientForTests(client) {
  testClientOverride = client;
}

export function __resetRatingV5RolloutClientForTests() {
  testClientOverride = null;
}

function resolveClient() {
  return testClientOverride || getSupabaseAuthClient();
}

export async function fetchRatingV5RolloutConfig() {
  const client = resolveClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  const { data, error } = await client
    .from("rating_v5_rollout_config")
    .select("shadow_mode_enabled, pilot_cohort_label, allow_v5_assessment, compare_v2_enabled")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }
  if (!data) {
    return { ok: false, code: "ROLLOUT_BLOCKED" };
  }

  return {
    ok: true,
    config: {
      shadowModeEnabled: Boolean(data.shadow_mode_enabled),
      pilotCohortLabel: String(data.pilot_cohort_label ?? "v5-shadow-pilot"),
      allowV5Assessment: Boolean(data.allow_v5_assessment),
      compareV2Enabled: Boolean(data.compare_v2_enabled),
    },
  };
}

export function isPilotEnrollmentActive({ rolloutConfig, enrollmentResult }) {
  if (!rolloutConfig?.allowV5Assessment || !rolloutConfig?.shadowModeEnabled) {
    return false;
  }
  if (!enrollmentResult?.ok || !enrollmentResult?.enrolled) {
    return false;
  }
  const status = enrollmentResult.enrollment?.status;
  return String(status).toLowerCase() === "active";
}

/**
 * @deprecated Profile rollout_cohort is metadata only — do not use for authorization.
 * Use isPilotEnrollmentActive + rating_v5_get_my_pilot_enrollment instead.
 */
export function isUserInRolloutCohort({ rolloutConfig, profile }) {
  void profile;
  void rolloutConfig;
  return false;
}

export async function fetchMyPilotEnrollment() {
  const client = resolveClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", enrolled: false };
  }

  const { data, error } = await client.rpc("rating_v5_get_my_pilot_enrollment");
  if (error) {
    return { ok: false, code: "RPC_FAILED", enrolled: false, error: error.message };
  }
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", enrolled: false };
  }
  return {
    ok: Boolean(data.ok),
    code: data.code ?? (data.enrolled ? "OK" : "PILOT_NOT_ENROLLED"),
    enrolled: Boolean(data.enrolled),
    enrollment: data.enrollment ?? null,
  };
}
