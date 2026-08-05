/**
 * AUTHOR ONLY — do not deploy (STAGING_DEPLOYMENT_GO=NO / EDGE_DEPLOYMENTS=0).
 *
 * Trusted Edge entry for CUTOVER-02 A3c fixture preparation.
 * Orchestration source of truth: src/features/player-rating/cutover-02/fixture-prep/
 * This Deno shell validates caller JWT + Staging project URL, then delegates
 * to service_role RPCs after allowlist checks. Never exposes service_role to browser.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const COHORT = "rating-v5-cutover-02-staging-rehearsal-wave-a";
const APPROVED = new Set([
  "e97fa28f4a36",
  "0b464be6cbba",
  "9154af71ee16",
  "d678d828c636",
  "3d644a31b486",
]);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function projectRefFromUrl(url: string) {
  try {
    const host = new URL(url).hostname || "";
    const m = host.match(/^([a-z0-9]+)\.supabase\.(co|in)$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    if (req.method !== "POST") {
      return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ref = projectRefFromUrl(supabaseUrl);

    if (!ref || ref === PRODUCTION_REF) {
      return json({ ok: false, code: "WRONG_PROJECT", reason: "PRODUCTION_OR_MISSING" }, 403);
    }
    if (ref !== STAGING_REF) {
      return json({ ok: false, code: "WRONG_PROJECT", reason: "WRONG_STAGING_OR_UNKNOWN" }, 403);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, code: "UNAUTHORIZED_CALLER", reason: "ANONYMOUS" }, 401);
    }

    const user = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await user.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return json({ ok: false, code: "UNAUTHORIZED_CALLER", reason: "INVALID_TOKEN" }, 401);
    }
    const callerId = userData.user.id;

    const { data: profile } = await user
      .from("profiles")
      .select("id, role, status")
      .eq("id", callerId)
      .maybeSingle();

    const isSuper = profile?.role === "SUPER_ADMIN" && profile?.status === "active";
    if (!isSuper) {
      // calibration_manage is enforced again inside service RPC / enrollment RPC
      return json({
        ok: false,
        code: "UNAUTHORIZED_CALLER",
        reason: "SUPER_ADMIN_REQUIRED_AT_EDGE_SHELL",
        note: "calibration_manage accepted by orchestrator/SQL when Edge shell is extended",
      }, 403);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.candidatePassword || body?.candidateJwt || body?.password) {
      return json({
        ok: false,
        code: "UNAUTHORIZED_CALLER",
        reason: "CANDIDATE_CREDENTIAL_PROHIBITED",
      }, 400);
    }

    const cohortLabel = String(body?.cohort_label || body?.cohortLabel || "");
    if (cohortLabel !== COHORT) {
      return json({ ok: false, code: "WRONG_COHORT" }, 400);
    }

    const targetPlayerId = String(body?.target_player_id || body?.targetPlayerId || "");
    if (!targetPlayerId) {
      return json({ ok: false, code: "TARGET_NOT_APPROVED", reason: "MISSING_TARGET" }, 400);
    }

    // Create draft via Staging-only service RPC (no candidate JWT).
    const { data, error } = await service.rpc(
      "rating_v5_cutover_02_a3c_service_create_fixture_assessment",
      {
        p_caller_id: callerId,
        p_target_player_id: targetPlayerId,
        p_cohort_label: cohortLabel,
        p_preparation_version: body?.preparation_version || "a3c-v1",
        p_tenant_id: body?.tenant_id || null,
      },
    );

    if (error) {
      return json({
        ok: false,
        code: "INTERNAL_ERROR_ROLLED_BACK",
        message: String(error.message || error),
      }, 500);
    }

    const hash = data?.candidate_id_hash;
    if (hash && !APPROVED.has(String(hash))) {
      return json({ ok: false, code: "TARGET_NOT_APPROVED" }, 403);
    }

    return json({
      ok: Boolean(data?.ok),
      ...data,
      candidateJwtRequired: false,
      candidatePasswordRequired: false,
      mappingStatus: "UNAPPROVED",
      edgeDeployed: false,
      note: "AUTHOR_ONLY scaffold — full orchestrator lives in src fixture-prep; STAGING_DEPLOYMENT_GO=NO",
    });
  } catch (err) {
    return json({
      ok: false,
      code: "INTERNAL_ERROR_ROLLED_BACK",
      error: String((err as Error)?.message ?? err),
    }, 500);
  }
});
