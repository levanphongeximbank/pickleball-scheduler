import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();
const env = getStagingSupabaseEnv();
const admin = createClient(env.url, env.serviceKey);

const { data: profile } = await admin
  .from("profiles")
  .select("id,email,player_id,club_id,role,venue_id")
  .eq("email", "player@staging.local")
  .single();

const { data: auth, error: signErr } = await admin.auth.signInWithPassword({
  email: "player@staging.local",
  password: process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358",
});

if (signErr) {
  console.error(signErr);
  process.exit(1);
}

// Simulate client: use anon if available, else use session from signIn
const anonKey = env.anonKey;
let clientProfile = null;
if (anonKey) {
  const client = createClient(env.url, anonKey);
  await client.auth.setSession({
    access_token: auth.session.access_token,
    refresh_token: auth.session.refresh_token,
  });
  const { data, error } = await client
    .from("profiles")
    .select("id,email,player_id,club_id,role,venue_id")
    .eq("id", auth.user.id)
    .single();
  clientProfile = { data, error: error?.message };
} else {
  clientProfile = { skipped: "no anon key in env" };
}

console.log(JSON.stringify({ adminProfile: profile, clientProfile }, null, 2));
