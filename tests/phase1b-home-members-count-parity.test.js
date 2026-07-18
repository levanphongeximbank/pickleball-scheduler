import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  countActiveClubMembers,
  isClubMemberStatusActive,
} from "../src/features/club/constants/clubMemberRoles.js";
import { mapV2MemberRowToUi } from "../src/features/club/services/clubMemberService.js";
import {
  buildMyClubSummaryFromClub,
  resolveMyClubHomeMemberCount,
} from "../src/features/club/services/clubActiveMembershipService.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Phase 1B — Home count vs Members active-list parity", () => {
  it("Home SoT uses active_member_count from canonical club payload", () => {
    const club = mapV2ClubToUiClub({
      id: "club-1",
      tenant_id: "tenant-1",
      name: "Parity Club",
      status: "active",
      version: 3,
      active_member_count: 4,
      owner_user_id: null,
      president_user_id: "u-pres",
      vice_president_user_ids: [],
    });
    const summary = buildMyClubSummaryFromClub(club);
    assert.equal(summary.memberCount, 4);

    const prev = process.env.VITE_CLUB_STORAGE_V2;
    const prevUrl = process.env.VITE_SUPABASE_URL;
    const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
    process.env.VITE_CLUB_STORAGE_V2 = "true";
    process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIn0.unit";
    try {
      assert.equal(resolveMyClubHomeMemberCount({ clubSummary: summary, clubStats: { activeMemberCount: 99 } }), 4);
    } finally {
      if (prev === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
      else process.env.VITE_CLUB_STORAGE_V2 = prev;
      if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
    }
  });

  it("Members tab active count matches Home when using the same active rule", () => {
    const rows = [
      { id: "1", user_id: "u1", status: "active", display_name: "A", governance_roles: ["president"] },
      { id: "2", user_id: "u2", status: "active", display_name: "B", governance_roles: [] },
      { id: "3", user_id: "u3", status: "left", display_name: "C", governance_roles: [] },
      { id: "4", user_id: "u4", status: "removed", display_name: "D", governance_roles: [] },
      { id: "5", user_id: "u5", status: "active", display_name: "E", governance_roles: ["vice_president"] },
    ];
    const members = rows.map(mapV2MemberRowToUi);
    const membersActive = countActiveClubMembers(members);
    const homeCount = rows.filter((row) => isClubMemberStatusActive(row.status)).length;

    assert.equal(membersActive, 3);
    assert.equal(homeCount, 3);
    assert.equal(membersActive, homeCount);
    // President + VP included when status=active
    assert.equal(
      members.filter((m) => m.governanceRoles.includes("president") && isClubMemberStatusActive(m.status)).length,
      1
    );
  });

  it("phase42_club_canonical SQL counts only status=active", () => {
    const sql = readFileSync(
      join(__dirname, "../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql"),
      "utf8"
    );
    assert.match(
      sql,
      /select count\(\*\)::int into v_member_count\s+from public\.club_members\s+where club_id = p_club_id and status = 'active'/i
    );
  });
});
