import { isPickVnRatingV5Enabled } from "../config/flags.js";
import { fetchRatingV5RolloutConfig, isUserInRolloutCohort } from "./ratingV5RolloutService.js";
import { rpcRatingV5GetProfile } from "./ratingV5RpcService.js";

export async function resolveRatingV5Access() {
  if (!isPickVnRatingV5Enabled()) {
    return { ok: false, code: "FEATURE_DISABLED", visible: false };
  }

  const rollout = await fetchRatingV5RolloutConfig();
  if (!rollout.ok) {
    return { ok: false, code: rollout.code ?? "ROLLOUT_BLOCKED", visible: false };
  }

  const profileResult = await rpcRatingV5GetProfile("doubles");
  const profile = profileResult.ok ? profileResult.profile : null;
  const inCohort = isUserInRolloutCohort({
    rolloutConfig: rollout.config,
    profile,
  });

  if (!inCohort) {
    return {
      ok: false,
      code: "ROLLOUT_BLOCKED",
      visible: false,
      rolloutConfig: rollout.config,
      profile,
    };
  }

  return {
    ok: true,
    code: "OK",
    visible: true,
    rolloutConfig: rollout.config,
    profile,
  };
}

export function canViewV5InternalCompare(user, { rbacEnabled = false } = {}) {
  if (!user) return false;
  const role = String(user.role ?? "").toUpperCase();
  if (role === "SYSTEM_TECHNICIAN" || role === "SUPER_ADMIN" || role === "CLUB_OWNER") {
    return true;
  }
  if (rbacEnabled && Array.isArray(user.permissions)) {
    return user.permissions.includes("rating_v5.view_any");
  }
  return false;
}
