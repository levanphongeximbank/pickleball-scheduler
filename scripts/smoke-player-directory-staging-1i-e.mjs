/**
 * Phase 1I-E — Read-only Staging smoke for Public Player Directory RPCs.
 * Loads gitignored .env.staging-qa.local. Never mutates profiles.
 * Prints sanitized summary only (no tokens / passwords / emails).
 *
 * Usage: node scripts/smoke-player-directory-staging-1i-e.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.staging-qa.local");

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PROD_REF = "expuvcohlcjzvrrauvud";
const DTO_KEYS = new Set([
  "player_id",
  "display_name",
  "is_verified",
  "avatar_url",
  "activity_region",
  "gender",
  "handedness",
]);
const FORBIDDEN_KEYS = [
  "email",
  "phone",
  "auth_user_id",
  "privacy_settings",
  "birth_date",
  "birth_year",
  "rating",
  "tenant_id",
  "venue_id",
  "club_id",
];

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function summarizeRow(row) {
  if (!row || typeof row !== "object") return { ok: false, reason: "null_row" };
  const keys = Object.keys(row);
  const extra = keys.filter((k) => !DTO_KEYS.has(k));
  const forbiddenHit = FORBIDDEN_KEYS.filter((k) => k in row);
  return {
    ok: forbiddenHit.length === 0,
    keyCount: keys.length,
    hasOnlyDtoOrKnown: extra.length === 0,
    extraKeys: extra,
    forbiddenHit,
    optionalPresent: {
      activity_region: row.activity_region != null,
      gender: row.gender != null,
      handedness: row.handedness != null,
      avatar_url: row.avatar_url != null,
    },
  };
}

async function main() {
  const env = loadEnvFile(envPath);
  const url = env.STAGING_SUPABASE_URL || "";
  const anon = env.STAGING_SUPABASE_ANON_KEY || "";
  const email = env.STAGING_OWNER_A_EMAIL || "";
  const password = env.STAGING_OWNER_A_PASSWORD || "";

  if (!url || !anon || !email || !password) {
    console.log(
      JSON.stringify({
        status: "NOT_RUN_CREDENTIALS_UNAVAILABLE",
        stagingProject: STAGING_REF,
      })
    );
    process.exit(0);
  }

  if (url.includes(PROD_REF)) {
    console.log(
      JSON.stringify({
        status: "BLOCKED_PRODUCTION_REF",
        message: "Refused to run against Production project",
      })
    );
    process.exit(2);
  }

  if (!url.includes(STAGING_REF)) {
    console.log(
      JSON.stringify({
        status: "BLOCKED_UNEXPECTED_PROJECT",
        message: "URL does not match approved Staging project ref",
      })
    );
    process.exit(2);
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.session) {
    console.log(
      JSON.stringify({
        status: "NOT_RUN_AUTH_FAILED",
        code: authError?.code || null,
        // no message body that might leak email
      })
    );
    process.exit(0);
  }

  const search = await supabase.rpc("player_directory_search", {
    p_query: null,
    p_region: null,
    p_cursor: null,
    p_limit: 5,
  });

  function unwrapEnvelope(rpcPayload) {
    const envelope = rpcPayload?.data;
    if (!envelope || typeof envelope !== "object") {
      return { ok: !rpcPayload?.error, data: null, code: rpcPayload?.error?.code || null };
    }
    return {
      ok: envelope.ok !== false && !rpcPayload?.error,
      data: envelope.data ?? null,
      code: envelope.code || rpcPayload?.error?.code || null,
      nextCursor: envelope.meta?.next_cursor ?? envelope.meta?.nextCursor ?? null,
    };
  }

  const searchEnv = unwrapEnvelope(search);
  const items = Array.isArray(searchEnv.data) ? searchEnv.data : [];
  const detailId =
    items[0]?.player_id != null ? String(items[0].player_id) : "nonexistent-player-id-1i-e";

  const detail = await supabase.rpc("player_directory_get", {
    p_player_id: detailId,
  });
  const detailEnv = unwrapEnvelope(detail);

  const missing = await supabase.rpc("player_directory_get", {
    p_player_id: "nonexistent-player-id-1i-e-missing",
  });
  const missingEnv = unwrapEnvelope(missing);

  await supabase.auth.signOut();

  const detailPlayer =
    detailEnv.data && typeof detailEnv.data === "object" && !Array.isArray(detailEnv.data)
      ? detailEnv.data
      : null;

  const report = {
    status: "RAN_READ_ONLY",
    stagingProject: STAGING_REF,
    productionRefUsed: false,
    profileMutations: false,
    search: {
      ok: searchEnv.ok,
      errorCode: searchEnv.code,
      itemCount: items.length,
      nextCursorPresent: Boolean(searchEnv.nextCursor),
      items: items.map(summarizeRow),
    },
    detail: {
      ok: detailEnv.ok,
      errorCode: detailEnv.code,
      playerPresent: detailPlayer != null,
      summary: detailPlayer ? summarizeRow(detailPlayer) : null,
    },
    missingOrHidden: {
      ok: missingEnv.ok,
      errorCode: missingEnv.code,
      playerNull: missingEnv.data == null,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.log(
    JSON.stringify({
      status: "NOT_RUN_UNEXPECTED_ERROR",
      name: err?.name || "Error",
    })
  );
  process.exit(0);
});
