import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCompleteAssessmentHttpRequest } from "../_shared/ratingV5Server.mjs";

function createSupabaseClients(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const user = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  return { user, service };
}

async function resolveTenantId(userClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await userClient
    .from("profiles")
    .select("venue_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.venue_id ? String(data.venue_id) : "platform";
}

async function fetchAssessmentRow(userClient: ReturnType<typeof createClient>, assessmentId: string) {
  const { data, error } = await userClient
    .from("player_skill_assessments")
    .select("*")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  try {
    return await handleCompleteAssessmentHttpRequest(req, {
      createSupabaseClients,
      resolveTenantId,
      fetchAssessmentRow,
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      RATING_V5_CORS_ORIGINS: Deno.env.get("RATING_V5_CORS_ORIGINS") ?? "",
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, code: "EDGE_RUNTIME_ERROR", error: String(err?.message ?? err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
