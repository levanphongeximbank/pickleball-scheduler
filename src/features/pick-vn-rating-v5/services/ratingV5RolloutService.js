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

export function isUserInRolloutCohort({ rolloutConfig, profile }) {
  if (!rolloutConfig?.allowV5Assessment || !rolloutConfig?.shadowModeEnabled) {
    return false;
  }
  const pilotLabel = rolloutConfig.pilotCohortLabel || "v5-shadow-pilot";
  if (!profile) {
    return true;
  }
  const cohort = profile.rollout_cohort ?? profile.rolloutCohort;
  if (!cohort) {
    return true;
  }
  return cohort === pilotLabel;
}
