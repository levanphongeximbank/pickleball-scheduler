/**
 * Phase 2E — Canonical governance read model + UI integration tests.
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
  isCanonicalGovernanceReadEnabled,
  mapGovernanceRoleCodesToLabel,
  resolveGovernanceRefreshAction,
  resolveMemberGovernanceRoleLabel,
  shouldRefetchGovernanceOnConflict,
  toGovernanceDisplayLabels,
  toGovernanceReadModel,
  toGovernanceReadSnapshot,
} from "../src/features/club/context/governanceCanonicalReadModel.js";
import { getGovernanceDisplayLabels } from "../src/features/club/services/clubGovernanceService.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";
import {
  buildMemberRowsFromV2Members,
  resolvePresidentDisplayLabel,
} from "../src/pages/player/myClub/myClubViewLogic.js";
import { getVicePresidentUserIds } from "../src/features/club/models/clubGovernance.js";

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
    id: "club-2e",
    tenantId: "tenant-a",
    version: 7,
    source: "v2-rpc",
    activeMemberCount: 12,
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

test("Phase 2E — 1 canonical owner read", () => {
  const model = toGovernanceReadModel({ club: baseClub(), v2Enabled: true });
  assert.equal(model.owner.user_id, "owner-1");
  assert.equal(model.owner.display_label, "Owner Name");
  assert.equal(model.labels.ownerLabel, "Owner Name");
});

test("Phase 2E — 2 canonical president read", () => {
  const model = toGovernanceReadModel({ club: baseClub(), v2Enabled: true });
  assert.equal(model.president.user_id, "pres-1");
  assert.equal(model.president.display_label, "President Name");
  assert.equal(resolvePresidentDisplayLabel(model.labels), "President Name");
});

test("Phase 2E — 3 one vice president", () => {
  const club = baseClub({
    vicePresidentLabels: ["Only VP"],
    governance: {
      ownerUserId: "owner-1",
      presidentUserId: "pres-1",
      vicePresidentUserIds: ["vp-1"],
      vicePresidentUserId: "vp-1",
    },
  });
  const model = toGovernanceReadModel({ club, v2Enabled: true });
  assert.equal(model.vice_presidents.length, 1);
  assert.equal(model.vice_presidents[0].display_label, "Only VP");
  assert.equal(model.labels.vicePresidentLabels.length, 1);
});

test("Phase 2E — 4 two vice presidents", () => {
  const model = toGovernanceReadModel({ club: baseClub(), v2Enabled: true });
  assert.equal(model.vice_presidents.length, 2);
  assert.deepEqual(
    model.vice_presidents.map((vp) => vp.user_id),
    ["vp-1", "vp-2"]
  );
  assert.equal(model.labels.vicePresidentLabel, "VP One, VP Two");
});

test("Phase 2E — 5 no vice president", () => {
  const club = baseClub({
    vicePresidentLabels: [],
    governance: {
      ownerUserId: "owner-1",
      presidentUserId: "pres-1",
      vicePresidentUserIds: [],
      vicePresidentUserId: null,
    },
  });
  const model = toGovernanceReadModel({ club, v2Enabled: true });
  assert.equal(model.vice_presidents.length, 0);
  assert.equal(model.labels.vicePresidentLabel, GOVERNANCE_NO_VP_LABEL);
});

test("Phase 2E — 6 missing profile fallback", () => {
  const club = baseClub({
    ownerLabel: null,
    presidentLabel: null,
    vicePresidentLabels: [],
  });
  const model = toGovernanceReadModel({
    club,
    profileByUserId: {},
    v2Enabled: true,
  });
  assert.equal(model.owner.display_label, GOVERNANCE_MISSING_PROFILE_LABEL);
  assert.equal(model.president.display_label, GOVERNANCE_MISSING_PROFILE_LABEL);
  assert.equal(model.vice_presidents[0].display_label, GOVERNANCE_MISSING_PROFILE_LABEL);
  assert.ok(!String(model.owner.display_label).startsWith("User "));
});

test("Phase 2E — 7 inactive/removed member marked stale", () => {
  const model = toGovernanceReadModel({
    club: baseClub({ ownerLabel: "Should Hide", presidentLabel: "Active Pres" }),
    membershipByUserId: {
      "owner-1": { id: "m-owner", status: "removed" },
      "pres-1": { id: "m-pres", status: "active" },
      "vp-1": { id: "m-vp1", status: "left" },
      "vp-2": { id: "m-vp2", status: "active" },
    },
    v2Enabled: true,
  });
  assert.equal(model.owner.stale_reference, true);
  assert.equal(model.owner.display_label, GOVERNANCE_MISSING_PROFILE_LABEL);
  assert.equal(model.president.stale_reference, false);
  assert.equal(model.vice_presidents[0].stale_reference, true);
  assert.equal(model.vice_presidents[1].stale_reference, false);
});

test("Phase 2E — 8 profiles.club_id ignored for eligibility", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      ownerLabel: null,
      governance: {
        ownerUserId: null,
        presidentUserId: "pres-1",
        vicePresidentUserIds: [],
      },
    }),
    profileByUserId: {
      "stranger-1": {
        displayName: "Stranger",
        avatarUrl: "https://example.com/a.png",
        clubId: "club-2e",
      },
    },
    v2Enabled: true,
  });
  assert.equal(model.owner, null);
  assert.equal(model.source.ignored.profiles_club_id, true);
  // Stranger never becomes owner just because profiles.club_id matches.
  assert.notEqual(model.president?.user_id, "stranger-1");
});

test("Phase 2E — 9 legacy blob role ignored under V2", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      governance: {
        ownerUserId: "owner-1",
        presidentUserId: "pres-1",
        vicePresidentUserIds: [],
      },
    }),
    v2Enabled: true,
    legacyBlobRoles: ["president", "owner", "admin"],
  });
  assert.equal(model.source.ignored.legacy_blob_roles, true);
  assert.equal(model.vice_presidents.length, 0);
  assert.equal(
    mapGovernanceRoleCodesToLabel(["admin", "manager"]),
    null
  );
});

test("Phase 2E — 10 cross-tenant hydration denied contract", () => {
  const model = toGovernanceReadModel({
    club: baseClub({
      ownerLabel: null,
      governance: {
        ownerUserId: null,
        presidentUserId: "pres-1",
        vicePresidentUserIds: [],
      },
    }),
    profileByUserId: {
      "foreign-1": {
        displayName: "Foreign",
        clubId: "club-2e",
      },
    },
    v2Enabled: true,
  });
  // profiles.club_id never promotes a foreign user into governance.
  assert.equal(model.owner, null);
  assert.equal(model.source.ignored.profiles_club_id, true);

  const svc = readSrc("src/features/club/services/governanceReadService.js");
  assert.match(svc, /deniedCrossTenantIds/);
  assert.match(svc, /expectedTenantId/);
  assert.match(svc, /profileTenant !== expectedTenantId/);
});

test("Phase 2E — 11 Club Home uses canonical model (source wiring)", () => {
  const page = readSrc("src/pages/player/MyClubPage.jsx");
  assert.match(page, /useGovernanceReadModel/);
  assert.match(page, /GOVERNANCE_READ_STATE/);
  assert.doesNotMatch(page, /fetchGovernanceNameHints/);
});

test("Phase 2E — 12 member list uses canonical model", () => {
  const rows = buildMemberRowsFromV2Members(
    [
      {
        id: "m1",
        user_id: "pres-1",
        display_name: "Pres",
        status: "active",
        membership_type: "regular",
        governance_roles: ["president"],
      },
      {
        id: "m2",
        user_id: "vp-1",
        display_name: "VP",
        status: "active",
        membership_type: "regular",
        governance_roles: ["vice_president"],
      },
    ],
    baseClub().governance,
    getVicePresidentUserIds
  );
  assert.equal(rows.find((r) => r.name === "Pres")?.governanceRole, GOVERNANCE_ROLE_LABELS.president);
  assert.equal(rows.find((r) => r.name === "VP")?.governanceRole, GOVERNANCE_ROLE_LABELS.vice_president);

  const logic = readSrc("src/pages/player/myClub/myClubViewLogic.js");
  assert.match(logic, /resolveMemberGovernanceRoleLabel/);
});

test("Phase 2E — 13 management screen uses canonical model", () => {
  const panel = readSrc("src/pages/clubs/ClubGovernancePanel.jsx");
  assert.match(panel, /useGovernanceReadModel/);
  assert.match(panel, /GOVERNANCE_READ_STATE/);
  assert.doesNotMatch(panel, /fetchGovernanceNameHints/);
});

test("Phase 2E — 14 same user not double-counted", () => {
  const club = baseClub({
    ownerLabel: "Same Person",
    presidentLabel: "Same Person",
    governance: {
      ownerUserId: "same-1",
      presidentUserId: "same-1",
      vicePresidentUserIds: ["vp-1"],
    },
    vicePresidentLabels: ["VP"],
  });
  const model = toGovernanceReadModel({ club, v2Enabled: true });
  assert.equal(model.labels.combinedOwnerPresident, true);
  assert.match(model.labels.ownerLabel, /Chủ sở hữu & Chủ tịch/);
  assert.equal(model.labels.presidentLabel, null);
  assert.equal(model.unique_active_officer_count, 2); // same-1 + vp-1
  assert.equal(
    countUniqueActiveGovernancePersons(model),
    2
  );
});

test("Phase 2E — 15 member totals remain correct (not inflated by officers)", () => {
  const model = toGovernanceReadModel({ club: baseClub(), v2Enabled: true });
  assert.equal(model.active_member_count, 12);
  assert.ok(model.unique_active_officer_count <= model.active_member_count);
  // Officers are not added on top of active_member_count.
  assert.equal(model.active_member_count, baseClub().activeMemberCount);
});

test("Phase 2E — 16 version refresh after governance mutation", () => {
  const action = resolveGovernanceRefreshAction({
    ok: true,
    version: 8,
    previousVersion: 7,
  });
  assert.equal(action.refresh, true);
  assert.equal(action.reason, "MUTATION_SUCCESS");
});

test("Phase 2E — 17 VERSION_CONFLICT refetch", () => {
  assert.equal(shouldRefetchGovernanceOnConflict("VERSION_CONFLICT"), true);
  const action = resolveGovernanceRefreshAction({
    ok: false,
    code: "VERSION_CONFLICT",
  });
  assert.equal(action.refresh, true);
  assert.equal(action.reason, "VERSION_CONFLICT");

  const snap = toGovernanceReadSnapshot({
    ok: false,
    code: "VERSION_CONFLICT",
  });
  assert.equal(snap.state, GOVERNANCE_READ_STATE.ERROR);
  assert.equal(snap.readModel, null);
});

test("Phase 2E — 18 loading state", () => {
  assert.equal(GOVERNANCE_READ_STATE.LOADING, "loading");
  assert.equal(isCanonicalGovernanceReadEnabled({ v2StorageEnabled: true }), true);
  assert.equal(isCanonicalGovernanceReadEnabled({ v2StorageEnabled: false }), false);
});

test("Phase 2E — 19 error state", () => {
  const snap = toGovernanceReadSnapshot({
    ok: false,
    code: "FORBIDDEN",
  });
  assert.equal(snap.state, GOVERNANCE_READ_STATE.ERROR);
  assert.equal(snap.readModel, null);
  assert.ok(snap.errorCode);

  const empty = toGovernanceReadSnapshot(null);
  assert.equal(empty.state, GOVERNANCE_READ_STATE.ERROR);
});

test("Phase 2E — 20 raw RPC/barrel boundary remains closed", () => {
  const barrel = readSrc("src/features/club/index.js");
  assert.match(barrel, /governanceGet/);
  assert.match(barrel, /toGovernanceReadModel/);
  assert.match(barrel, /readClubGovernance/);
  // Raw mutating governance RPCs must stay off the public barrel (Phase 2D + 2E).
  assert.doesNotMatch(barrel, /rpcV2ClubAssignOwner/);
  assert.doesNotMatch(barrel, /rpcV2ClubTransferPresident/);
  assert.doesNotMatch(barrel, /rpcV2ClubAssignVicePresident/);
  assert.doesNotMatch(barrel, /rpcV2ClubClearVicePresident/);
  assert.doesNotMatch(barrel, /rpcV2HasClubGovernanceRole/);

  const api = readSrc("src/features/club/api/governanceApi.js");
  assert.match(api, /readModel/);
  // Read integration must not open direct table clients for assignments.
  assert.doesNotMatch(api, /\.from\(["']club_governance_assignments["']\)/);
});

test("Phase 2E — mapV2ClubToUiClub feeds canonical read model", () => {
  const club = mapV2ClubToUiClub({
    id: "c1",
    name: "Club",
    tenant_id: "t1",
    version: 3,
    owner_user_id: "o1",
    owner_label: "O",
    president_user_id: "p1",
    president_label: "P",
    vice_president_user_ids: ["v1"],
    vice_president_labels: ["V"],
    active_member_count: 5,
  });
  const model = toGovernanceReadModel({ club, v2Enabled: true });
  assert.equal(model.club_id, "c1");
  assert.equal(model.tenant_id, "t1");
  assert.equal(model.club_version, 3);
  assert.equal(model.owner.user_id, "o1");
  assert.equal(model.president.user_id, "p1");
  assert.equal(model.vice_presidents[0].user_id, "v1");
});

test("Phase 2E — getGovernanceDisplayLabels delegates to read model under V2", async () => {
  await withV2Env(() => {
    const labels = getGovernanceDisplayLabels(
      baseClub({
        governance: {
          ownerUserId: null,
          presidentUserId: null,
          vicePresidentUserIds: [],
        },
      }),
      "tenant-a",
      {}
    );
    assert.equal(labels.ownerLabel, GOVERNANCE_UNASSIGNED_LABEL);
    assert.equal(labels.presidentLabel, GOVERNANCE_UNASSIGNED_LABEL);
    assert.equal(labels.vicePresidentLabel, GOVERNANCE_NO_VP_LABEL);
  });
});

test("Phase 2E — role codes mapping is explicit (no generic inference)", () => {
  assert.equal(mapGovernanceRoleCodesToLabel(["club_owner"]), GOVERNANCE_ROLE_LABELS.owner);
  assert.equal(mapGovernanceRoleCodesToLabel(["president"]), GOVERNANCE_ROLE_LABELS.president);
  assert.equal(
    mapGovernanceRoleCodesToLabel(["vice_president"]),
    GOVERNANCE_ROLE_LABELS.vice_president
  );
  assert.equal(
    resolveMemberGovernanceRoleLabel("u1", { ownerUserId: "u1", presidentUserId: "u1" }),
    GOVERNANCE_ROLE_LABELS.owner_and_president
  );
  assert.equal(mapGovernanceRoleCodesToLabel(["member", "player"]), null);
});

test("Phase 2E — display labels helper for empty assignment", () => {
  const labels = toGovernanceDisplayLabels({
    owner: null,
    president: null,
    vice_presidents: [],
  });
  assert.equal(labels.ownerLabel, GOVERNANCE_UNASSIGNED_LABEL);
  assert.equal(labels.presidentLabel, GOVERNANCE_UNASSIGNED_LABEL);
  assert.equal(labels.vicePresidentLabel, GOVERNANCE_NO_VP_LABEL);
});
