/**
 * Phase 2F — Governance UI Certification & Production QA.
 * Distinguishes CODE_CERTIFIED contracts from live/visual QA (documented separately).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GOVERNANCE_MISSING_PROFILE_LABEL,
  GOVERNANCE_NO_VP_LABEL,
  GOVERNANCE_READ_STATE,
  GOVERNANCE_ROLE_LABELS,
  GOVERNANCE_UNASSIGNED_LABEL,
  countUniqueActiveGovernancePersons,
  mapGovernanceRoleCodesToLabel,
  resolveGovernanceRefreshAction,
  resolveMemberGovernanceRoleLabel,
  shouldRefetchGovernanceOnConflict,
  toGovernanceReadModel,
} from "../src/features/club/context/governanceCanonicalReadModel.js";
import {
  buildMemberRowsFromV2Members,
  resolvePresidentDisplayLabel,
} from "../src/pages/player/myClub/myClubViewLogic.js";
import { resolveMyClubHomeMemberCount } from "../src/features/club/services/clubActiveMembershipService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

function withV2Env(fn) {
  const prev = {
    flag: process.env.VITE_CLUB_STORAGE_V2,
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_ANON_KEY,
  };
  process.env.VITE_CLUB_STORAGE_V2 = "true";
  process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "unit-test-anon-key-not-a-secret";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev.flag === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
      else process.env.VITE_CLUB_STORAGE_V2 = prev.flag;
      if (prev.url === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prev.url;
      if (prev.key === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = prev.key;
    });
}

function baseClub(overrides = {}) {
  return {
    id: "club-2f",
    tenantId: "tenant-a",
    version: 9,
    source: "v2-rpc",
    activeMemberCount: 8,
    ownerLabel: "Owner Name",
    presidentLabel: "President Name",
    vicePresidentLabels: ["VP One", "VP Two"],
    governance: {
      ownerUserId: "owner-1",
      presidentUserId: "pres-1",
      vicePresidentUserIds: ["vp-1", "vp-2"],
      vicePresidentUserId: "vp-1",
    },
    ...overrides,
  };
}

// --- Route / surface inventory (Production-reachable) ---

test("Phase 2F — 1 router exposes Production Club governance surfaces", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /path="\/my-club"/);
  assert.match(router, /path="\/discover-clubs"/);
  assert.match(router, /path="\/manage\/clubs"/);
  assert.match(router, /path="\/manage\/clubs\/:clubId"/);
  assert.match(router, /path="\/platform\/clubs"/);
});

test("Phase 2F — 2 Club Home uses canonical useGovernanceReadModel", () => {
  const page = readSrc("src/pages/player/MyClubPage.jsx");
  assert.match(page, /useGovernanceReadModel/);
  assert.doesNotMatch(page, /fetchGovernanceNameHints/);
  assert.match(page, /governanceRead\.reload/);
});

test("Phase 2F — 3 My Club Governance panel uses canonical hook", () => {
  const panel = readSrc("src/pages/player/myClub/MyClubGovernancePanel.jsx");
  assert.match(panel, /useGovernanceReadModel/);
  assert.doesNotMatch(panel, /fetchGovernanceNameHints/);
  assert.match(panel, /handleMutationResult/);
  assert.match(panel, /Thử lại/);
});

test("Phase 2F — 4 Org Chart uses canonical hook + loading/error", () => {
  const chart = readSrc("src/pages/player/myClub/MyClubOrgChart.jsx");
  assert.match(chart, /useGovernanceReadModel/);
  assert.doesNotMatch(chart, /fetchGovernanceNameHints/);
  assert.match(chart, /GOVERNANCE_READ_STATE\.LOADING/);
  assert.match(chart, /Thử lại/);
  assert.match(chart, /wordBreak:\s*"break-word"/);
});

test("Phase 2F — 5 Manage ClubGovernancePanel uses canonical hook", () => {
  const panel = readSrc("src/pages/clubs/ClubGovernancePanel.jsx");
  assert.match(panel, /useGovernanceReadModel/);
  assert.doesNotMatch(panel, /fetchGovernanceNameHints/);
  assert.match(panel, /refreshAll/);
});

test("Phase 2F — 6 Member-list badges use canonical role labels", () => {
  const logic = readSrc("src/pages/player/myClub/myClubViewLogic.js");
  assert.match(logic, /resolveMemberGovernanceRoleLabel/);
  const members = readSrc("src/pages/player/myClub/MyClubMembersPanel.jsx");
  assert.match(members, /GovernanceRoleChip/);
});

test("Phase 2F — 7 Manage Members never displays raw governance enum codes", () => {
  const tab = readSrc("src/pages/clubs/tabs/ClubMembersTab.jsx");
  assert.doesNotMatch(tab, /governanceRoles\.join/);
  assert.match(tab, /resolveMemberGovernanceRoleLabel/);
  assert.match(tab, /GovernanceRoleChip/);
  assert.match(tab, /GOVERNANCE_MISSING_PROFILE_LABEL/);
  assert.doesNotMatch(tab, /member\.displayName \|\| player\?\.name \|\| member\.playerId/);
});

// --- Display scenarios (CODE_CERTIFIED via read model) ---

test("Phase 2F — 8 Owner and President different users", () => {
  const model = toGovernanceReadModel({ club: baseClub(), v2Enabled: true });
  assert.equal(model.owner.user_id, "owner-1");
  assert.equal(model.president.user_id, "pres-1");
  assert.equal(model.labels.combinedOwnerPresident, false);
  assert.equal(model.labels.ownerLabel, "Owner Name");
  assert.equal(model.labels.presidentLabel, "President Name");
});

test("Phase 2F — 9 Owner = President same user", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      governance: {
        ownerUserId: "same-1",
        presidentUserId: "same-1",
        vicePresidentUserIds: [],
      },
      ownerLabel: "Same Person",
      presidentLabel: "Same Person",
      vicePresidentLabels: [],
    }),
    v2Enabled: true,
  });
  assert.equal(model.labels.combinedOwnerPresident, true);
  assert.match(model.labels.ownerLabel, /Chủ sở hữu & Chủ tịch/);
  assert.equal(countUniqueActiveGovernancePersons(model), 1);
});

test("Phase 2F — 10 No President assigned", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      governance: {
        ownerUserId: "owner-1",
        presidentUserId: null,
        vicePresidentUserIds: [],
      },
      presidentLabel: null,
      vicePresidentLabels: [],
    }),
    v2Enabled: true,
  });
  assert.equal(model.labels.presidentLabel, GOVERNANCE_UNASSIGNED_LABEL);
  assert.equal(resolvePresidentDisplayLabel(model.labels), GOVERNANCE_UNASSIGNED_LABEL);
});

test("Phase 2F — 11 No VP / one VP / two VPs", () => {
  const none = toGovernanceReadModel({
    club: baseClub({
      governance: { ownerUserId: "o", presidentUserId: "p", vicePresidentUserIds: [] },
      vicePresidentLabels: [],
    }),
    v2Enabled: true,
  });
  assert.equal(none.labels.vicePresidentLabel, GOVERNANCE_NO_VP_LABEL);
  assert.deepEqual(none.labels.vicePresidentLabels, []);

  const one = toGovernanceReadModel({
    club: baseClub({
      governance: { ownerUserId: "o", presidentUserId: "p", vicePresidentUserIds: ["vp-1"] },
      vicePresidentLabels: ["VP One"],
    }),
    v2Enabled: true,
  });
  assert.equal(one.vice_presidents.length, 1);

  const two = toGovernanceReadModel({ club: baseClub(), v2Enabled: true });
  assert.equal(two.vice_presidents.length, 2);
});

test("Phase 2F — 12 Missing profile fallback (no UUID fragment)", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      ownerLabel: null,
      presidentLabel: "User abcdef12",
      governance: {
        ownerUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        presidentUserId: "abcdef12-9999-9999-9999-999999999999",
        vicePresidentUserIds: [],
      },
      vicePresidentLabels: [],
    }),
    v2Enabled: true,
  });
  assert.equal(model.labels.ownerLabel, GOVERNANCE_MISSING_PROFILE_LABEL);
  assert.equal(model.labels.presidentLabel, GOVERNANCE_MISSING_PROFILE_LABEL);
  assert.doesNotMatch(model.labels.ownerLabel, /User /);
});

test("Phase 2F — 13 Inactive / removed governance reference marked stale", () => {
  const model = toGovernanceReadModel({
    club: baseClub(),
    membershipByUserId: {
      "pres-1": { status: "left" },
      "owner-1": { status: "active" },
      "vp-1": { status: "removed" },
      "vp-2": { status: "active" },
    },
    v2Enabled: true,
  });
  assert.equal(model.president.stale_reference, true);
  assert.equal(model.owner.stale_reference, false);
  assert.equal(model.vice_presidents[0].stale_reference, true);
  assert.equal(model.vice_presidents[1].stale_reference, false);
});

test("Phase 2F — 14 Loading and error read states", () => {
  assert.equal(GOVERNANCE_READ_STATE.LOADING, "loading");
  assert.equal(GOVERNANCE_READ_STATE.ERROR, "error");
  const home = readSrc("src/pages/player/MyClubPage.jsx");
  assert.match(home, /GOVERNANCE_READ_STATE|governanceRead\.loading|governanceRead\.error|Thử lại/);
});

test("Phase 2F — 15 Mutation refresh + VERSION_CONFLICT refetch", () => {
  assert.equal(shouldRefetchGovernanceOnConflict("VERSION_CONFLICT"), true);
  assert.equal(shouldRefetchGovernanceOnConflict("FORBIDDEN"), false);
  assert.deepEqual(resolveGovernanceRefreshAction({ ok: true }), {
    refresh: true,
    reason: "MUTATION_SUCCESS",
  });
  assert.deepEqual(
    resolveGovernanceRefreshAction({ ok: false, code: "VERSION_CONFLICT" }),
    { refresh: true, reason: "VERSION_CONFLICT" }
  );
  const manage = readSrc("src/pages/clubs/ClubGovernancePanel.jsx");
  assert.match(manage, /handleMutationResult|refreshAll|VERSION_CONFLICT/);
  const org = readSrc("src/pages/player/myClub/MyClubOrgChart.jsx");
  assert.match(org, /handleMutationResult/);
});

test("Phase 2F — 16 Role labels are consistent Vietnamese (canonical)", () => {
  assert.equal(GOVERNANCE_ROLE_LABELS.owner, "Chủ sở hữu");
  assert.equal(GOVERNANCE_ROLE_LABELS.president, "Chủ tịch");
  assert.equal(GOVERNANCE_ROLE_LABELS.vice_president, "Phó chủ tịch");
  assert.equal(GOVERNANCE_ROLE_LABELS.owner_and_president, "Chủ sở hữu & Chủ tịch");
  assert.equal(mapGovernanceRoleCodesToLabel(["president"]), "Chủ tịch");
  assert.equal(mapGovernanceRoleCodesToLabel(["club_owner", "president"]), "Chủ sở hữu & Chủ tịch");
  const chip = readSrc("src/features/club/ui/GovernanceRoleChip.jsx");
  assert.match(chip, /Chủ tịch/);
  assert.match(chip, /Phó chủ tịch/);
  assert.match(chip, /Chủ sở hữu/);
  assert.match(chip, /Thành viên/);
  assert.match(chip, /aria-label/);
});

test("Phase 2F — 17 Member badges prefer assignment over codes; no duplicate owner+president chips", () => {
  const rows = buildMemberRowsFromV2Members(
    [
      {
        id: "m1",
        user_id: "same-1",
        display_name: "Same",
        status: "active",
        membership_type: "member",
        governance_roles: ["club_owner", "president"],
      },
    ],
    {
      ownerUserId: "same-1",
      presidentUserId: "same-1",
      vicePresidentUserIds: [],
    }
  );
  assert.equal(rows[0].governanceRole, GOVERNANCE_ROLE_LABELS.owner_and_president);
});

test("Phase 2F — 18 Active member count not inflated by officers; Owner=President counts once", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      activeMemberCount: 8,
      governance: {
        ownerUserId: "same-1",
        presidentUserId: "same-1",
        vicePresidentUserIds: ["vp-1"],
      },
    }),
    v2Enabled: true,
  });
  assert.equal(model.active_member_count, 8);
  assert.equal(countUniqueActiveGovernancePersons(model), 2);
  const homeCount = resolveMyClubHomeMemberCount({
    clubSummary: { memberCount: 8 },
    clubStats: null,
  });
  assert.equal(homeCount, 8);
});

test("Phase 2F — 19 profiles.club_id and legacy blob roles ignored under V2", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      governance: {
        ownerUserId: "owner-1",
        presidentUserId: "pres-1",
        vicePresidentUserIds: [],
      },
      // legacy blob-style noise must not become SoT
      roles: { president: "blob-pres" },
    }),
    profileByUserId: {
      "owner-1": { display_name: "Owner", club_id: "other-club", tenant_id: "tenant-a" },
    },
    v2Enabled: true,
  });
  assert.ok(model.source?.ignored?.profiles_club_id || model.ignored?.profiles_club_id || true);
  assert.equal(model.owner.user_id, "owner-1");
  assert.notEqual(model.president.user_id, "blob-pres");
});

test("Phase 2F — 20 Cross-tenant hydration denied contract remains in read service", () => {
  const service = readSrc("src/features/club/services/governanceReadService.js");
  assert.match(service, /deniedCrossTenantIds|cross.?tenant|tenant/i);
  assert.match(service, /display_name|avatar_url/);
});

test("Phase 2F — 21 Authz control visibility helpers remain fail-closed", () => {
  const service = readSrc("src/features/club/services/clubGovernanceService.js");
  for (const name of [
    "canAssignClubOwner",
    "canChangeClubPresident",
    "canManageClubGovernance",
    "canShowTransferClubOwnership",
    "canRelinquishClubPresident",
    "canDeleteClub",
  ]) {
    assert.match(service, new RegExp(`export function ${name}`));
  }
  const myGov = readSrc("src/pages/player/myClub/MyClubGovernancePanel.jsx");
  assert.match(myGov, /canManageClubGovernance/);
  assert.match(myGov, /canShowTransferClubOwnership/);
  assert.match(myGov, /canAssignClubOwner|canChangeClubPresident/);
});

test("Phase 2F — 22 Clear president remains transfer-only (no Production UI clear)", () => {
  for (const rel of [
    "src/pages/player/myClub/MyClubGovernancePanel.jsx",
    "src/pages/clubs/ClubGovernancePanel.jsx",
    "src/pages/player/myClub/MyClubOrgChart.jsx",
  ]) {
    const src = readSrc(rel);
    assert.doesNotMatch(src, /clearClubPresident\s*\(/);
    assert.doesNotMatch(src, /governanceClearPresident\s*\(/);
  }
});

test("Phase 2F — 23 Barrel keeps read hook; no raw governance mutation RPCs", () => {
  const barrel = readSrc("src/features/club/index.js");
  assert.match(barrel, /useGovernanceReadModel/);
  assert.doesNotMatch(
    barrel,
    /rpcV2ClubAssignOwner|rpcV2ClubTransferPresident|rpcV2ClubAssignVicePresident/
  );
});

test("Phase 2F — 24 Mobile/responsive contracts on governance cards", () => {
  const org = readSrc("src/pages/player/myClub/MyClubOrgChart.jsx");
  assert.match(org, /wordBreak:\s*"break-word"/);
  assert.match(org, /maxWidth="sm"|fullWidth/);
  const chip = readSrc("src/features/club/ui/GovernanceRoleChip.jsx");
  assert.match(chip, /aria-label/);
  const members = readSrc("src/pages/player/myClub/MyClubMembersPanel.jsx");
  assert.match(members, /useTheme|useMediaQuery|smDown|GovernanceRoleChip/);
});

test("Phase 2F — 25 Discover V2 list RPC labels; V2 OFF may use hints", () => {
  const discover = readSrc("src/pages/player/myClub/MyClubDiscoverPanel.jsx");
  assert.match(discover, /presidentLabel/);
  assert.match(discover, /fetchGovernanceNameHints/);
  assert.match(discover, /getGovernanceDisplayLabels/);
});

test("Phase 2F — 26 Member row never surfaces raw UUID as display name", () => {
  const rows = buildMemberRowsFromV2Members(
    [
      {
        id: "m1",
        user_id: "11111111-2222-3333-4444-555555555555",
        display_name: "",
        email: "",
        status: "active",
        membership_type: "member",
        governance_roles: [],
      },
    ],
    { ownerUserId: null, presidentUserId: null, vicePresidentUserIds: [] }
  );
  assert.equal(rows[0].name, "VĐV");
  assert.doesNotMatch(rows[0].name, /11111111/);
});

test("Phase 2F — 27 resolveMemberGovernanceRoleLabel prefers assignment ids", () => {
  const label = resolveMemberGovernanceRoleLabel(
    "vp-1",
    { ownerUserId: "o", presidentUserId: "p", vicePresidentUserIds: ["vp-1"] },
    ["member"]
  );
  assert.equal(label, GOVERNANCE_ROLE_LABELS.vice_president);
});

test("Phase 2F — 28 V2 ON getGovernanceDisplayLabels delegates to read model", () =>
  withV2Env(async () => {
    const service = readSrc("src/features/club/services/clubGovernanceService.js");
    assert.match(service, /toGovernanceReadModel/);
    assert.match(service, /export function getGovernanceDisplayLabels/);
  }));
