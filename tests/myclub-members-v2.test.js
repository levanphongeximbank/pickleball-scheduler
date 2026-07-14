import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMemberRowsFromV2Members,
  mapV2GovernanceRoleCodes,
} from "../src/pages/player/myClub/myClubViewLogic.js";

const getVice = (gov) => {
  if (!gov) return [];
  if (Array.isArray(gov.vicePresidentUserIds)) return gov.vicePresidentUserIds;
  if (gov.vicePresidentUserId) return [gov.vicePresidentUserId];
  return [];
};

test("mapV2GovernanceRoleCodes maps role codes to VN labels", () => {
  assert.equal(mapV2GovernanceRoleCodes(["president", "club_owner"]), "Chủ sở hữu & Chủ tịch");
  assert.equal(mapV2GovernanceRoleCodes(["president"]), "Chủ tịch");
  assert.equal(mapV2GovernanceRoleCodes(["vice_president"]), "Phó chủ tịch");
  assert.equal(mapV2GovernanceRoleCodes(["club_owner"]), "Chủ sở hữu");
  assert.equal(mapV2GovernanceRoleCodes([]), null);
  assert.equal(mapV2GovernanceRoleCodes(null), null);
});

test("buildMemberRowsFromV2Members maps RPC rows, sorts by name, marks active", () => {
  const members = [
    {
      id: "m2",
      user_id: "u-bob",
      display_name: "Bình",
      email: "binh@example.com",
      status: "active",
      membership_type: "regular",
      governance_roles: [],
    },
    {
      id: "m1",
      user_id: "u-anh",
      display_name: "Anh",
      email: "anh@example.com",
      status: "inactive",
      membership_type: "regular",
      governance_roles: ["vice_president"],
    },
  ];

  const rows = buildMemberRowsFromV2Members(members, { ownerUserId: null, presidentUserId: null }, getVice);

  assert.equal(rows.length, 2);
  // Sorted by Vietnamese name: "Anh" before "Bình"
  assert.equal(rows[0].name, "Anh");
  assert.equal(rows[0].governanceRole, "Phó chủ tịch");
  assert.equal(rows[0].isActive, false);
  assert.equal(rows[0].memberRole, "Thành viên");
  assert.equal(rows[1].name, "Bình");
  assert.equal(rows[1].governanceRole, null);
  assert.equal(rows[1].isActive, true);
});

test("buildMemberRowsFromV2Members prefers club governance (owner/president) over codes", () => {
  const members = [
    {
      id: "m1",
      user_id: "u-owner",
      display_name: "Hải",
      status: "active",
      membership_type: "regular",
      governance_roles: [],
    },
  ];
  const rows = buildMemberRowsFromV2Members(
    members,
    { ownerUserId: "u-owner", presidentUserId: "u-owner" },
    getVice
  );
  assert.equal(rows[0].governanceRole, "Chủ sở hữu & Chủ tịch");
});

test("buildMemberRowsFromV2Members falls back to email/user_id for name and tolerates empty", () => {
  assert.deepEqual(buildMemberRowsFromV2Members(null, null, getVice), []);
  const rows = buildMemberRowsFromV2Members(
    [{ id: "m1", user_id: "u-1", email: "x@e.com", status: "active" }],
    null,
    getVice
  );
  assert.equal(rows[0].name, "x@e.com");
});
