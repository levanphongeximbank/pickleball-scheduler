/**
 * Application-boundary helper: finalize match via Competition Remote SSOT.
 * Keep out of domain/matchLiveSync to avoid architecture boundary violations.
 */

import { getSupabaseAuthClient } from "../../auth/supabaseClient.js";
import {
  isCompetitionRemoteSsotEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import { resolveCompetitionSsotAdapter } from "./competitionSsotAdapter.js";

export async function finalizeMatchViaCompetitionSsot(input = {}, env) {
  if (!isCompetitionRemoteSsotEnabled(env)) {
    return {
      ok: false,
      code: "COMPETITION_SSOT_DISABLED",
      error: "Enable VITE_COMPETITION_REMOTE_SSOT_ENABLED after M8 SQL apply.",
    };
  }

  const supabase = getSupabaseAuthClient();
  if (!supabase) {
    return {
      ok: false,
      code: "COMPETITION_SSOT_UNAVAILABLE",
      error: "Supabase client unavailable for Competition SSOT finalize.",
    };
  }

  const adapter = resolveCompetitionSsotAdapter({
    env,
    rpc: (name, args) => supabase.rpc(name, args),
  });

  return adapter.finalizeMatchResult({
    tenantId: input.tenantId,
    matchId: input.matchId,
    resultPayload: input.resultPayload || {},
    idempotencyKey: input.idempotencyKey,
    winnerSide: input.winnerSide,
    source: input.source || "competition_ssot_finalize",
  });
}
