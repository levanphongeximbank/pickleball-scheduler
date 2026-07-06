/**
 * Gán role TEAM_CAPTAIN cho profile theo email (Supabase service role).
 *
 * Usage:
 *   node scripts/grant-team-captain.mjs doitruong@gmail.com
 *   node scripts/grant-team-captain.mjs doitruong@gmail.com --tournament-id=xxx --team-id=yyy
 */
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";

function readArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

async function main() {
  loadProjectEnv();

  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/grant-team-captain.mjs <email> [--tournament-id=] [--team-id=]");
    process.exit(1);
  }

  const url = String(process.env.VITE_SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !serviceKey) {
    console.error("Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
    process.exit(1);
  }

  const tournamentId = readArg("tournament-id");
  const teamId = readArg("team-id");

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const selectFields = "id, email, role, venue_id, club_id, player_id, status";

  const { data: before, error: fetchError } = await client
    .from("profiles")
    .select(selectFields)
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    console.error("Không đọc được profile:", fetchError.message);
    process.exit(1);
  }

  if (!before) {
    console.error(`Không tìm thấy profile cho ${email}`);
    process.exit(1);
  }

  const patch = {
    role: "TEAM_CAPTAIN",
    status: "active",
    updated_at: new Date().toISOString(),
  };

  if (tournamentId) {
    patch.tournament_id = tournamentId;
  }
  if (teamId) {
    patch.team_id = teamId;
  }

  let after = null;
  let updateError = null;

  const attempt = await client
    .from("profiles")
    .update(patch)
    .eq("id", before.id)
    .select(selectFields)
    .single();

  after = attempt.data;
  updateError = attempt.error;

  if (updateError && /tournament_id|team_id/i.test(updateError.message || "")) {
    const fallback = await client
      .from("profiles")
      .update({
        role: "TEAM_CAPTAIN",
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", before.id)
      .select(selectFields)
      .single();
    after = fallback.data;
    updateError = fallback.error;
    if (!updateError) {
      console.warn(
        "⚠️  DB chưa có cột tournament_id/team_id — chỉ cập nhật role. Chạy PHASE_V52_PRODUCTION_RBAC_ROLES.sql để bật scope đội trưởng đầy đủ."
      );
    }
  }

  if (updateError) {
    console.error("Cập nhật thất bại:", updateError.message);
    if (/profiles_role_check/i.test(updateError.message)) {
      console.error(
        "→ Chạy trước docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql trên Supabase (mở rộng constraint TEAM_CAPTAIN)."
      );
    }
    process.exit(1);
  }

  console.log("Trước:", JSON.stringify(before, null, 2));
  console.log("Sau:", JSON.stringify(after, null, 2));
  console.log("\n✅ Đã gán TEAM_CAPTAIN. Đăng xuất và đăng nhập lại để app nhận role mới.");
}

main();
