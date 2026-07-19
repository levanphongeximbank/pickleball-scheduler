import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listClubGovernanceCandidates,
  canManageClubGovernance,
  canDeleteClubMembers,
  canTransferClubOwnership,
  canShowTransferClubOwnership,
  canAssignClubOwner,
} from "../src/features/club/services/clubGovernanceService.js";
import {
  getVicePresidentUserIds,
  normalizeVicePresidentUserIds,
  MAX_VICE_PRESIDENTS,
} from "../src/features/club/models/clubGovernance.js";
import {
  formatMemberCommandUserError,
} from "../src/features/club/services/clubMemberService.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";
import { API_ERROR_CODES } from "../src/features/api/constants/apiErrors.js";
import { ROLES } from "../src/auth/roles.js";
import { enableRbac } from "../src/auth/authService.js";
import { CLUB_MEMBER_STATUSES, normalizeClubMemberStatus } from "../src/features/club/constants/clubMemberRoles.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

/** Mirror of Phase 1C candidate filter rules (active + user_id + dedupe). */
function filterV2GovernanceCandidates(members = []) {
  const candidateMap = new Map();
  for (const row of members) {
    if (normalizeClubMemberStatus(row.status) !== CLUB_MEMBER_STATUSES.ACTIVE) {
      continue;
    }
    const userId = String(row.user_id || "").trim();
    if (!userId || candidateMap.has(userId)) {
      continue;
    }
    candidateMap.set(userId, {
      userId,
      displayName: String(row.display_name || "").trim() || `User ${userId.slice(0, 8)}`,
    });
  }
  return Array.from(candidateMap.values());
}

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe("Phase 1C — V2 governance candidates + member UX helpers", () => {
  let previousLocalStorage;
  let previousEnv;

  beforeEach(() => {
    previousLocalStorage = globalThis.localStorage;
    previousEnv = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      VITE_CLUB_STORAGE_V2: process.env.VITE_CLUB_STORAGE_V2,
      VITE_RBAC_ENABLED: process.env.VITE_RBAC_ENABLED,
    };
    globalThis.localStorage = createLocalStorageMock();
    process.env.VITE_SUPABASE_URL = "https://qyewbxjsiiyufanzcjcq.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test";
    process.env.VITE_CLUB_STORAGE_V2 = "true";
    process.env.VITE_RBAC_ENABLED = "true";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      import.meta.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
      import.meta.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
      import.meta.env.VITE_CLUB_STORAGE_V2 = "true";
      import.meta.env.VITE_RBAC_ENABLED = "true";
    }
    enableRbac(true);
  });

  afterEach(() => {
    globalThis.localStorage = previousLocalStorage;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("V2 ON: sync listClubGovernanceCandidates returns empty (forces async path)", () => {
    assert.deepEqual(listClubGovernanceCandidates("club-1", "tenant-1"), []);
  });

  it("V2 candidate filter keeps active+user_id only and dedupes", () => {
    const rows = filterV2GovernanceCandidates([
      { user_id: "u-active-1", display_name: "Active One", status: "active" },
      { user_id: "u-active-1", display_name: "Active One Dup", status: "active" },
      { user_id: "u-left", display_name: "Left Member", status: "left" },
      { user_id: "u-removed", display_name: "Removed Member", status: "removed" },
      { user_id: null, display_name: "No User", status: "active" },
      { user_id: "u-active-2", display_name: "Active Two", status: "active" },
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((r) => r.userId).sort(),
      ["u-active-1", "u-active-2"]
    );
  });

  it("V2 OFF: sync candidates path remains available (missing club → [])", () => {
    process.env.VITE_CLUB_STORAGE_V2 = "false";
    assert.deepEqual(listClubGovernanceCandidates("missing-club", "tenant-1"), []);
  });

  it("formatMemberCommandUserError maps VERSION_CONFLICT and FORBIDDEN safely", () => {
    assert.equal(
      formatMemberCommandUserError({
        ok: false,
        code: API_ERROR_CODES.CONFLICT,
        serverCode: "VERSION_CONFLICT",
        error: "raw stack",
      }),
      "Dữ liệu CLB đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại."
    );
    assert.match(
      formatMemberCommandUserError({
        ok: false,
        code: API_ERROR_CODES.FORBIDDEN,
        serverCode: "FORBIDDEN",
        error: "Không đủ quyền.",
      }),
      /quyền/i
    );
    assert.equal(
      formatMemberCommandUserError({
        ok: false,
        code: API_ERROR_CODES.CONFLICT,
        serverCode: "ALREADY_MEMBER",
        error: "Đã là thành viên.",
      }),
      "Đã là thành viên."
    );
  });

  it("authorization visibility: VP alone cannot manage governance or delete members", () => {
    const club = {
      id: "club-1",
      governance: {
        presidentUserId: "pres-1",
        ownerUserId: "owner-1",
        vicePresidentUserIds: ["vp-1"],
      },
    };
    const vp = { id: "vp-1", role: ROLES.PLAYER };
    const president = { id: "pres-1", role: ROLES.PLAYER };
    const ordinary = { id: "member-1", role: ROLES.PLAYER };

    assert.equal(canManageClubGovernance(vp, club), false);
    assert.equal(canDeleteClubMembers(vp, club), false);
    assert.equal(canManageClubGovernance(president, club), true);
    assert.equal(canManageClubGovernance(ordinary, club), false);
  });

  it("V2 ON: Club Owner alone cannot see transfer control (RPC eligibility mismatch)", () => {
    process.env.VITE_CLUB_STORAGE_V2 = "true";
    const club = {
      id: "club-1",
      governance: { ownerUserId: "owner-1", presidentUserId: "pres-1" },
    };
    const clubOwnerOnly = { id: "owner-1", role: ROLES.PLAYER };
    const tenantOwnerAlsoClubOwner = { id: "owner-1", role: ROLES.TENANT_OWNER };

    assert.equal(canTransferClubOwnership(clubOwnerOnly, club), true);
    assert.equal(canAssignClubOwner(clubOwnerOnly), false);
    assert.equal(canShowTransferClubOwnership(clubOwnerOnly, club), false);

    assert.equal(canAssignClubOwner(tenantOwnerAlsoClubOwner), true);
    assert.equal(canShowTransferClubOwnership(tenantOwnerAlsoClubOwner, club), true);
  });

  it("V2 OFF: Club Owner alone still sees legacy transfer control", () => {
    process.env.VITE_CLUB_STORAGE_V2 = "false";
    if (typeof import.meta !== "undefined" && import.meta.env) {
      import.meta.env.VITE_CLUB_STORAGE_V2 = "false";
    }
    const club = {
      id: "club-1",
      governance: { ownerUserId: "owner-1", presidentUserId: "pres-1" },
    };
    const clubOwnerOnly = { id: "owner-1", role: ROLES.PLAYER };
    assert.equal(canShowTransferClubOwnership(clubOwnerOnly, club), true);
  });

  it("dual VP normalize caps at two ids", () => {
    assert.equal(MAX_VICE_PRESIDENTS, 2);
    assert.deepEqual(
      normalizeVicePresidentUserIds({ vicePresidentUserIds: ["a", "b", "c"] }),
      ["a", "b"]
    );
    assert.deepEqual(getVicePresidentUserIds({ vicePresidentUserIds: ["a", "b"] }), ["a", "b"]);
  });
});

describe("Phase 1C — Org Chart / Home count parity helper", () => {
  it("canonical activeMemberCount from mapped V2 club is preferred", () => {
    const club = mapV2ClubToUiClub({
      id: "club-1",
      name: "Test",
      status: "active",
      version: 3,
      active_member_count: 7,
      president_user_id: "p1",
      owner_user_id: "o1",
      vice_president_user_ids: ["v1", "v2"],
    });
    assert.equal(club.activeMemberCount, 7);
    assert.equal(club.version, 3);
    assert.deepEqual(getVicePresidentUserIds(club.governance), ["v1", "v2"]);
  });
});

describe("Phase 1C — wiring source contracts", () => {
  it("governance service exposes async V2 candidates via rpcV2ClubListMembers", () => {
    const src = readSrc("src/features/club/services/clubGovernanceService.js");
    assert.match(src, /export async function listClubGovernanceCandidatesAsync/);
    assert.match(src, /rpcV2ClubListMembers/);
    assert.match(src, /if \(isClubStorageV2Enabled\(\)\) \{\s*return \[\];/s);
  });

  it("Manage ClubGovernancePanel uses dual VP + setClubVicePresidents", () => {
    const src = readSrc("src/pages/clubs/ClubGovernancePanel.jsx");
    assert.match(src, /setClubVicePresidents/);
    assert.match(src, /vicePresidentIds/);
    assert.match(src, /Phó chủ tịch \$\{index \+ 1\}/);
    assert.match(src, /listClubGovernanceCandidatesAsync/);
    assert.doesNotMatch(src, /assignClubVicePresident/);
  });

  it("MyClub Org Chart / Governance accept clubRecord and async candidates", () => {
    const org = readSrc("src/pages/player/myClub/MyClubOrgChart.jsx");
    const gov = readSrc("src/pages/player/myClub/MyClubGovernancePanel.jsx");
    assert.match(org, /clubRecord/);
    assert.match(org, /activeMemberCount/);
    assert.match(org, /listClubGovernanceCandidatesAsync/);
    assert.match(gov, /clubRecord/);
    assert.match(gov, /listClubGovernanceCandidatesAsync/);
    assert.match(gov, /setClubVicePresidents/);
  });

  it("ClubDetailPage hydrates via useResolvedClubRecord under V2", () => {
    const src = readSrc("src/pages/clubs/ClubDetailPage.jsx");
    assert.match(src, /useResolvedClubRecord/);
    assert.match(src, /isClubStorageV2Enabled/);
  });

  it("ClubMembersTab exposes restore + status filters + conflict UX", () => {
    const src = readSrc("src/pages/clubs/tabs/ClubMembersTab.jsx");
    assert.match(src, /restoreMemberToClub/);
    assert.match(src, /formatMemberCommandUserError/);
    assert.match(src, /statusFilter/);
    assert.match(src, /canManageClubGovernance/);
    assert.match(src, /VERSION_CONFLICT/);
  });

  it("probe no longer treats FORBIDDEN list as write-ready", () => {
    const src = readSrc("src/features/club/services/clubMemberService.js");
    assert.match(src, /probeClubMemberMutationAccess/);
    assert.doesNotMatch(
      src,
      /FORBIDDEN[\s\S]{0,80}return \{ ok: true, provider: "v2-rpc"/
    );
  });

  it("transferClubOwnership V2 uses rpcV2ClubAssignOwner, not updateClubMeta", () => {
    const src = readSrc("src/features/club/services/clubGovernanceService.js");
    const start = src.indexOf("export async function transferClubOwnership");
    assert.ok(start >= 0, "transferClubOwnership must be async");
    const nextExport = src.indexOf("\nexport async function transferClubPresident", start + 1);
    const body = src.slice(start, nextExport > start ? nextExport : start + 3500);
    assert.match(body, /isClubStorageV2Enabled\(\)/);
    assert.match(body, /rpcV2ClubAssignOwner/);
    assert.match(body, /expectedClubVersion/);
    assert.match(body, /club\.owner\.transfer/);
    assert.match(body, /provider: "v2-rpc"/);
    // V2 branch must not write registry meta
    const v2Branch = body.slice(0, body.indexOf("getRegistryClubById"));
    assert.doesNotMatch(v2Branch, /updateClubMeta/);
    // V1 fallback still present
    assert.match(body, /updateClubMeta/);
  });

  it("assignClubOwner V2 maps VERSION_CONFLICT/FORBIDDEN and passes expected version", () => {
    const src = readSrc("src/features/club/services/clubGovernanceService.js");
    const start = src.indexOf("export async function assignClubOwner");
    const next = src.indexOf("\nexport function approveClubRegistration", start + 1);
    const body = src.slice(start, next > start ? next : start + 2500);
    assert.match(body, /rpcV2ClubAssignOwner/);
    assert.match(body, /rpcV2ClubClearOwner/);
    assert.match(body, /mapGovernanceCommandError/);
    assert.match(body, /expectedClubVersion/);
  });

  it("My Club transfer owner awaits V2 path and reloads on conflict", () => {
    const src = readSrc("src/pages/player/myClub/MyClubGovernancePanel.jsx");
    assert.match(src, /await transferClubOwnership/);
    assert.match(src, /expectedClubVersion:\s*club\.version/);
    assert.match(src, /mapGovernanceError\(result\)/);
  });

  it("AssignClubOwnerDialog and Manage panel pass expectedClubVersion", () => {
    const dialog = readSrc("src/pages/player/myClub/AssignClubOwnerDialog.jsx");
    const manage = readSrc("src/pages/clubs/ClubGovernancePanel.jsx");
    assert.match(dialog, /expectedClubVersion:\s*clubVersion/);
    assert.match(dialog, /VERSION_CONFLICT/);
    assert.match(manage, /expectedClubVersion:\s*club\.version/);
  });

  it("My Club Governance uses canShowTransferClubOwnership under V2 alignment", () => {
    const src = readSrc("src/pages/player/myClub/MyClubGovernancePanel.jsx");
    assert.match(src, /canShowTransferClubOwnership/);
    assert.doesNotMatch(src, /canTransferOwner = canTransferClubOwnership/);
  });

  it("security gate SQL narrows assign/clear owner away from bare tenant_member", () => {
    const gate = readSrc(
      "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql"
    );
    assert.match(gate, /phase42_can_assign_club_owner/);
    assert.match(gate, /role_code = 'tenant_owner'/);
    assert.doesNotMatch(gate, /phase42_is_tenant_member\(v_club\.tenant_id\)/);
    assert.match(gate, /OPTIONAL \(Owner GO required\)/);
  });
});
