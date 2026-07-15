import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CLUB_MEMBER_STATUSES,
  countActiveClubMembers,
  getClubMemberStatusLabel,
  isClubMemberStatusActive,
  normalizeClubMemberStatus,
} from "../src/features/club/constants/clubMemberRoles.js";
import { mapV2MemberRowToUi } from "../src/features/club/services/clubMemberService.js";
import {
  buildMyClubSummaryFromClub,
  resolveMyClubHomeMemberCount,
} from "../src/features/club/services/clubActiveMembershipService.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";

const PRESIDENT_ID = "4cf24ed0-99f8-4997-b803-3c7ff8e32014";
const CLUB_ID = "club-accc-active-status";

function makeActiveRow(index, extra = {}) {
  return {
    id: `m-active-${index}`,
    user_id: index === 0 ? PRESIDENT_ID : `user-active-${index}`,
    display_name: index === 0 ? "Chủ tịch ACCC" : `Thành viên ${index}`,
    status: "active",
    membership_type: "regular",
    governance_roles: index === 0 ? ["president", "club_owner"] : [],
    ...extra,
  };
}

describe("club V2 active member status mismatch", () => {
  it("normalizes only status===active as active; left/removed/unknown are not", () => {
    assert.equal(normalizeClubMemberStatus("active"), CLUB_MEMBER_STATUSES.ACTIVE);
    assert.equal(normalizeClubMemberStatus("ACTIVE"), CLUB_MEMBER_STATUSES.ACTIVE);
    assert.equal(normalizeClubMemberStatus("left"), CLUB_MEMBER_STATUSES.LEFT);
    assert.equal(normalizeClubMemberStatus("removed"), CLUB_MEMBER_STATUSES.REMOVED);
    assert.equal(normalizeClubMemberStatus("inactive"), CLUB_MEMBER_STATUSES.INACTIVE);
    assert.equal(normalizeClubMemberStatus("pending"), "pending");
    assert.equal(normalizeClubMemberStatus("rejected"), "rejected");
    assert.equal(normalizeClubMemberStatus("mystery"), CLUB_MEMBER_STATUSES.INACTIVE);
    assert.equal(normalizeClubMemberStatus(""), CLUB_MEMBER_STATUSES.INACTIVE);
    assert.equal(normalizeClubMemberStatus(null), CLUB_MEMBER_STATUSES.INACTIVE);

    assert.equal(isClubMemberStatusActive("active"), true);
    assert.equal(isClubMemberStatusActive("left"), false);
    assert.equal(isClubMemberStatusActive("removed"), false);
    assert.equal(isClubMemberStatusActive("pending"), false);
    assert.equal(isClubMemberStatusActive("rejected"), false);
    assert.equal(isClubMemberStatusActive("unknown"), false);
  });

  it("mapV2MemberRowToUi does not treat left/removed as active (regression)", () => {
    assert.equal(mapV2MemberRowToUi({ status: "left" }).status, CLUB_MEMBER_STATUSES.LEFT);
    assert.equal(mapV2MemberRowToUi({ status: "removed" }).status, CLUB_MEMBER_STATUSES.REMOVED);
    assert.equal(mapV2MemberRowToUi({ status: "active" }).status, CLUB_MEMBER_STATUSES.ACTIVE);
    assert.equal(mapV2MemberRowToUi({ status: "pending" }).status, "pending");
    assert.equal(mapV2MemberRowToUi({ status: "garbage" }).status, CLUB_MEMBER_STATUSES.INACTIVE);

    assert.equal(isClubMemberStatusActive(mapV2MemberRowToUi({ status: "left" }).status), false);
    assert.equal(isClubMemberStatusActive(mapV2MemberRowToUi({ status: "removed" }).status), false);
  });

  it("left/removed chips are Đã rời / Đã xóa — never Đang hoạt động", () => {
    assert.equal(getClubMemberStatusLabel("left"), "Đã rời");
    assert.equal(getClubMemberStatusLabel("removed"), "Đã xóa");
    assert.equal(getClubMemberStatusLabel("active"), "Đang hoạt động");
    assert.notEqual(getClubMemberStatusLabel("left"), "Đang hoạt động");
    assert.notEqual(getClubMemberStatusLabel("removed"), "Đang hoạt động");
  });

  it("10 active + 1 left + 1 removed → Home=10 and Members active count=10", () => {
    const rpcRows = [
      ...Array.from({ length: 10 }, (_, i) => makeActiveRow(i)),
      {
        id: "m-left",
        user_id: "user-left-1",
        display_name: "Former Member",
        status: "left",
        membership_type: "regular",
        governance_roles: [],
      },
      {
        id: "m-removed",
        user_id: "user-removed-1",
        display_name: "QA42L Prod SA Member",
        status: "removed",
        membership_type: "regular",
        governance_roles: [],
      },
    ];

    const mapped = rpcRows.map(mapV2MemberRowToUi);
    const membersActive = countActiveClubMembers(mapped);
    assert.equal(mapped.length, 12);
    assert.equal(membersActive, 10);

    const club = mapV2ClubToUiClub({
      id: CLUB_ID,
      name: "ACCC",
      tenant_id: "venue-prod",
      status: "active",
      version: 1,
      owner_user_id: PRESIDENT_ID,
      president_user_id: PRESIDENT_ID,
      active_member_count: 10,
    });
    const summary = buildMyClubSummaryFromClub(club);
    const homeCount = resolveMyClubHomeMemberCount({ clubSummary: summary, clubStats: null });

    assert.equal(homeCount, 10);
    assert.equal(homeCount, membersActive);

    const president = mapped.find((m) => m.userId === PRESIDENT_ID);
    assert.ok(president);
    assert.equal(isClubMemberStatusActive(president.status), true);
    assert.ok(president.governanceRoles.includes("president"));
  });

  it("reload / remapping does not change active count (stable)", () => {
    const rpcRows = [
      ...Array.from({ length: 10 }, (_, i) => makeActiveRow(i)),
      { id: "m-left", user_id: "u-l", display_name: "Left", status: "left", governance_roles: [] },
      { id: "m-rem", user_id: "u-r", display_name: "Removed", status: "removed", governance_roles: [] },
    ];

    const first = countActiveClubMembers(rpcRows.map(mapV2MemberRowToUi));
    const second = countActiveClubMembers(rpcRows.map(mapV2MemberRowToUi));
    const third = countActiveClubMembers(rpcRows.map(mapV2MemberRowToUi));

    assert.equal(first, 10);
    assert.equal(second, 10);
    assert.equal(third, 10);

    const club = mapV2ClubToUiClub({
      id: CLUB_ID,
      name: "ACCC",
      tenant_id: "venue-prod",
      status: "active",
      active_member_count: 10,
    });
    const homeA = resolveMyClubHomeMemberCount({
      clubSummary: buildMyClubSummaryFromClub(club),
    });
    const homeB = resolveMyClubHomeMemberCount({
      clubSummary: buildMyClubSummaryFromClub(club),
    });
    assert.equal(homeA, homeB);
    assert.equal(homeA, first);
  });
});
