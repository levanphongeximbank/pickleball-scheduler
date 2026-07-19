import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { API_ERROR_CODES } from "../src/features/api/constants/apiErrors.js";
import {
  GOVERNANCE_AUDIT_EVENTS,
  resolveServerGovernanceAuditAction,
  resolveFreezeGovernanceAuditEvents,
} from "../src/features/club/constants/governanceAuditEvents.js";
import {
  canAssignClubOwner,
  canChangeClubPresident,
  canManageClubGovernance,
  clearClubPresident,
  updateClubGovernance,
} from "../src/features/club/services/clubGovernanceService.js";
import { assertLegacyGovernanceRoleWriteAllowed } from "../src/features/club/services/clubLegacyWriteGuard.js";
import {
  governanceClearPresident,
  governanceAssignOwner,
} from "../src/features/club/api/governanceApi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

function withV2Env(fn) {
  const prev = {
    flag: process.env.VITE_CLUB_STORAGE_V2,
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_ANON_KEY,
    rbac: process.env.VITE_RBAC_ENABLED,
  };
  process.env.VITE_CLUB_STORAGE_V2 = "true";
  process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "unit-test-anon-key-not-a-secret";
  process.env.VITE_RBAC_ENABLED = "true";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev.flag === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
      else process.env.VITE_CLUB_STORAGE_V2 = prev.flag;
      if (prev.url === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prev.url;
      if (prev.key === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = prev.key;
      if (prev.rbac === undefined) delete process.env.VITE_RBAC_ENABLED;
      else process.env.VITE_RBAC_ENABLED = prev.rbac;
    });
}

function withV2Off(fn) {
  const prev = process.env.VITE_CLUB_STORAGE_V2;
  process.env.VITE_CLUB_STORAGE_V2 = "false";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
      else process.env.VITE_CLUB_STORAGE_V2 = prev;
    });
}

const club = {
  id: "club-2d",
  tenantId: "tenant-a",
  governance: {
    ownerUserId: "owner-1",
    presidentUserId: "pres-1",
    vicePresidentUserIds: ["vp-1"],
  },
};

test("Phase 2D — audit freeze aliases map to server actions", () => {
  assert.equal(
    resolveServerGovernanceAuditAction(GOVERNANCE_AUDIT_EVENTS.OWNER_ASSIGNED),
    "club.assign_owner"
  );
  assert.equal(
    resolveServerGovernanceAuditAction(GOVERNANCE_AUDIT_EVENTS.OWNER_CLEARED),
    "club.clear_owner"
  );
  assert.equal(
    resolveServerGovernanceAuditAction(GOVERNANCE_AUDIT_EVENTS.PRESIDENT_ASSIGNED),
    "club.transfer_president"
  );
  assert.equal(
    resolveServerGovernanceAuditAction(GOVERNANCE_AUDIT_EVENTS.VP_ASSIGNED),
    "club.assign_vice_president"
  );
  assert.equal(
    resolveServerGovernanceAuditAction(GOVERNANCE_AUDIT_EVENTS.VP_CLEARED),
    "club.clear_vice_president"
  );
  assert.ok(
    resolveFreezeGovernanceAuditEvents("club.assign_owner").includes(
      GOVERNANCE_AUDIT_EVENTS.OWNER_ASSIGNED
    )
  );
});

test("Phase 2D — authorization matrix (client gates fail-closed with RBAC)", async () => {
  await withV2Env(() => {
    const sa = { id: "sa", role: "SUPER_ADMIN" };
    const tenantOwner = { id: "to", role: "TENANT_OWNER", venueId: "tenant-a" };
    const clubOwner = { id: "owner-1", role: "PLAYER" };
    const president = { id: "pres-1", role: "PLAYER" };
    const vp = { id: "vp-1", role: "PLAYER" };
    const manager = { id: "mgr", role: "CLUB_MANAGER" };
    const member = { id: "mem", role: "PLAYER" };
    const stranger = { id: "x", role: "PLAYER" };

    assert.equal(canAssignClubOwner(sa), true);
    assert.equal(canAssignClubOwner(tenantOwner), true);
    assert.equal(canAssignClubOwner(clubOwner), false);
    assert.equal(canAssignClubOwner(president), false);
    assert.equal(canAssignClubOwner(vp), false);
    assert.equal(canAssignClubOwner(manager), false);
    assert.equal(canAssignClubOwner(member), false);
    assert.equal(canAssignClubOwner(stranger), false);

    assert.equal(canChangeClubPresident(sa, club), true);
    assert.equal(canChangeClubPresident(tenantOwner, club), true);
    assert.equal(canChangeClubPresident(clubOwner, club), true);
    assert.equal(canChangeClubPresident(president, club), false);
    assert.equal(canChangeClubPresident(vp, club), false);
    assert.equal(canChangeClubPresident(manager, club), false);

    assert.equal(canManageClubGovernance(clubOwner, club), true);
    assert.equal(canManageClubGovernance(president, club), true);
    assert.equal(canManageClubGovernance(vp, club), false);
    assert.equal(canManageClubGovernance(manager, club), false);
    assert.equal(canManageClubGovernance(member, club), false);
  });
});

test("Phase 2D — clear president blocked under V2 (transfer-only)", async () => {
  await withV2Env(async () => {
    const cleared = await clearClubPresident("club-2d");
    assert.equal(cleared.ok, false);
    assert.equal(cleared.code, API_ERROR_CODES.VALIDATION_ERROR);
    assert.equal(cleared.serverCode, "PRESIDENT_CLEAR_VIA_TRANSFER_ONLY");

    const viaApi = await governanceClearPresident("club-2d");
    assert.equal(viaApi.ok, false);
    assert.equal(viaApi.serverCode, "PRESIDENT_CLEAR_VIA_TRANSFER_ONLY");
  });
});

test("Phase 2D — legacy updateClubGovernance role write blocked under V2", async () => {
  await withV2Env(() => {
    const gate = assertLegacyGovernanceRoleWriteAllowed({
      operation: "test",
    });
    assert.equal(gate.ok, false);
    assert.equal(gate.code, API_ERROR_CODES.FEATURE_DISABLED);

    const ownerPatch = updateClubGovernance("club-2d", { ownerUserId: "x" });
    assert.equal(ownerPatch.ok, false);
    assert.equal(ownerPatch.code, API_ERROR_CODES.FEATURE_DISABLED);

    const presidentPatch = updateClubGovernance("club-2d", {
      presidentUserId: "y",
    });
    assert.equal(presidentPatch.ok, false);
    assert.equal(presidentPatch.code, API_ERROR_CODES.FEATURE_DISABLED);

    const vpPatch = updateClubGovernance("club-2d", {
      vicePresidentUserIds: ["z"],
    });
    assert.equal(vpPatch.ok, false);
    assert.equal(vpPatch.code, API_ERROR_CODES.FEATURE_DISABLED);
  });
});

test("Phase 2D — V2 OFF retains legacy governance blob path (documented)", async () => {
  await withV2Off(() => {
    const gate = assertLegacyGovernanceRoleWriteAllowed({ operation: "test" });
    assert.equal(gate.ok, true);
  });
});

test("Phase 2D — Club barrel does not export raw governance mutating RPCs", () => {
  const barrel = readSrc("src/features/club/index.js");
  assert.doesNotMatch(barrel, /rpcV2ClubAssignOwner,/);
  assert.doesNotMatch(barrel, /rpcV2ClubClearOwner,/);
  assert.doesNotMatch(barrel, /rpcV2ClubTransferPresident,/);
  assert.doesNotMatch(barrel, /rpcV2ClubAssignVicePresident,/);
  assert.doesNotMatch(barrel, /rpcV2ClubClearVicePresident,/);
  assert.match(barrel, /governanceAssignOwner/);
  assert.match(barrel, /governanceClearOwner/);
  assert.match(barrel, /governanceAssignPresident/);
  assert.match(barrel, /governanceClearPresident/);
  assert.match(barrel, /governanceAssignVp/);
  assert.match(barrel, /governanceClearVp/);
  assert.match(barrel, /governanceGet/);
  assert.match(barrel, /from "\.\/api\/governanceApi\.js"/);
});

test("Phase 2D — canonical writers route through V2 RPCs (source contract)", () => {
  const gov = readSrc("src/features/club/services/clubGovernanceService.js");
  const assignStart = gov.indexOf("export async function assignClubOwner");
  const assignBody = gov.slice(assignStart, assignStart + 2200);
  assert.match(assignBody, /rpcV2ClubAssignOwner/);
  assert.match(assignBody, /rpcV2ClubClearOwner/);
  assert.match(assignBody, /requestId/);
  assert.doesNotMatch(assignBody.slice(0, 1800), /updateClubMeta/);

  const transferStart = gov.indexOf("export async function transferClubOwnership");
  const transferBody = gov.slice(transferStart, transferStart + 1800);
  assert.match(transferBody, /rpcV2ClubAssignOwner/);

  const presidentStart = gov.indexOf("export async function transferClubPresident");
  const presidentBody = gov.slice(presidentStart, presidentStart + 1600);
  assert.match(presidentBody, /rpcV2ClubTransferPresident/);

  const vpStart = gov.indexOf("export async function setClubVicePresidents");
  const vpBody = gov.slice(vpStart, vpStart + 4500);
  assert.match(vpBody, /rpcV2ClubAssignVicePresident/);
  assert.match(vpBody, /rpcV2ClubClearVicePresident/);

  const tenant = readSrc("src/features/club/services/clubTenantService.js");
  assert.match(tenant, /applyGovernanceRolePatchV2/);
  assert.match(tenant, /assignClubOwner/);
  assert.match(tenant, /transferClubPresident/);
});

test("Phase 2D — SQL contracts: authz helpers, OCC, audit, eligibility, search_path", () => {
  const ownerSql = readSrc(
    "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql"
  );
  assert.match(ownerSql, /phase42_can_assign_club_owner/);
  assert.match(ownerSql, /SET search_path TO 'public'/i);
  assert.match(ownerSql, /VERSION_CONFLICT/);
  assert.match(ownerSql, /phase42_write_audit/);
  assert.match(ownerSql, /status = 'active'/);
  assert.match(ownerSql, /MEMBER_REQUIRED/);
  assert.match(ownerSql, /phase42_idempotency_get/);
  assert.doesNotMatch(
    ownerSql.split("create or replace function public.phase42_can_assign_club_owner")[1]?.slice(0, 1500) || "",
    /VENUE_MANAGER|COURT_MANAGER/
  );

  const vpSql = readSrc("docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql");
  assert.match(vpSql, /phase42_can_manage_vice_presidents/);
  assert.match(vpSql, /Tối đa 2 Phó chủ tịch/);
  assert.match(vpSql, /club\.assign_vice_president/);
  assert.match(vpSql, /club\.clear_vice_president/);

  const phase2d = readSrc(
    "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql"
  );
  assert.match(phase2d, /phase42_can_transfer_president/);
  assert.match(phase2d, /phase42_write_audit/);
  assert.match(phase2d, /VERSION_CONFLICT/);
  assert.match(phase2d, /MEMBER_REQUIRED/);
  const transferFn = phase2d.slice(
    phase2d.indexOf("CREATE OR REPLACE FUNCTION public.club_transfer_president")
  );
  assert.doesNotMatch(transferFn, /phase42_is_tenant_member\(/);
  assert.match(phase2d, /set search_path = public/i);
});

test("Phase 2D — null/stale profile club_id is not used for assign-owner eligibility", () => {
  const ownerSql = readSrc(
    "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql"
  );
  const assignFn = ownerSql.slice(
    ownerSql.indexOf("CREATE OR REPLACE FUNCTION public.club_assign_owner")
  );
  assert.match(assignFn, /from public\.club_members/);
  assert.doesNotMatch(assignFn.slice(0, 2500), /profiles\.club_id/);
});

test("Phase 2D — governanceApi is thin façade over certified service", () => {
  const api = readSrc("src/features/club/api/governanceApi.js");
  assert.match(api, /assignClubOwner/);
  assert.match(api, /transferClubPresident/);
  assert.match(api, /clearClubPresident/);
  assert.match(api, /setClubVicePresidents/);
  assert.match(api, /GOVERNANCE_AUDIT_EVENTS/);
  assert.equal(typeof governanceAssignOwner, "function");
});

test("Phase 2D — failed clear-president produces no success audit event", async () => {
  await withV2Env(async () => {
    const result = await governanceClearPresident("club-x");
    assert.equal(result.ok, false);
    assert.equal(result.auditEvent, undefined);
  });
});
