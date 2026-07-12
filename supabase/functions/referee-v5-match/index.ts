import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleRefereeV5MatchHttpRequest } from "../_shared/refereeV5Server.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function createSupabaseClients(authHeader) {
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

Deno.serve(async (req) => {
  try {
    return await handleRefereeV5MatchHttpRequest(req, { createSupabaseClients });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, code: "EDGE_RUNTIME_ERROR", error: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
