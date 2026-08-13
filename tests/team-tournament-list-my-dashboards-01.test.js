/**
 * My Tournaments hub — discoverability + Dashboard visibility parity contracts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { filterMenuGroups, getRouteAccessPermissions } from "../src/auth/menuAccess.js";
import {
  isAuthenticatedOnlyRoute,
  isPublicAuthPath,
  shouldRedirectToLogin,
} from "../src/auth/authGuard.js";
import { isMyTournamentsHubPath } from "../src/auth/tournamentEngineRouteAccess.js";
import { SIDEBAR_MENU_GROUPS } from "../src/config/sidebarMenu.js";
import { collectMenuItemLabels } from "../src/config/navigationConfig.js";
import { TOURNAMENT_ROUTES } from "../src/config/tournamentRoutes.js";
import {
  normalizeMyDashboardListResult,
  projectMyDashboardCard,
  roleLabelsVi,
} from "../src/features/team-tournament/my-dashboards/myDashboardsModel.js";
import { canViewTournamentDashboard } from "../src/features/team-tournament/lifecycle/teamTournamentLifecycle.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = join(__dirname, "../docs/v5/migrations/team-tournament-list-my-dashboards-01");

const LOCKED = Object.freeze({
  "01_PRECHECK.sql":
    "468ca37aa7dc20fd5783f2ddcf829570c29b8cc394494c68a98ac1faa5bc240a",
  "02_APPLY.sql":
    "03d82a7b714171f7334a30944795b81146ca66b67a4f06777fe6d1fedbf527aa",
  "03_VERIFY.sql":
    "74141a654d0d941bd1e51c8830ec5f70393b9c08a82ed5f20e66f0de150e4430",
  "04_ROLLBACK.sql":
    "57a99d0894f9cecf3224842f9181c3de02569d1aa7c96321978e65bb1ee1afd5",
});

function sha256(rel) {
  const text = readFileSync(join(pkg, rel), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function playerUser() {
  return { id: "u-player", role: ROLES.PLAYER, permissions: [] };
}

describe("team-tournament-list-my-dashboards-01 package", () => {
  it("encodes athletes-only identity and Dashboard visibility parity", () => {
    const apply = readFileSync(join(pkg, "02_APPLY.sql"), "utf8");
    const precheck = readFileSync(join(pkg, "01_PRECHECK.sql"), "utf8");
    const verify = readFileSync(join(pkg, "03_VERIFY.sql"), "utf8");

    assert.match(precheck, /5fa16a3b7f7ea6c4647dfb855fff965c/);
    assert.match(apply, /team_tournament_list_my_dashboards/);
    assert.match(apply, /from public\.athletes a/);
    assert.match(apply, /team_tournament_can_view_dashboard/);
    assert.doesNotMatch(apply, /team_tournament_user_player_id/);
    assert.doesNotMatch(apply, /p_tenant_id/);
    assert.doesNotMatch(apply, /p_club_id/);
    assert.doesNotMatch(apply, /p_player_id/);
    assert.match(verify, /legacy player_id authority must not appear/);
  });

  it("locked SHA256 fingerprints match package files", () => {
    for (const [file, expected] of Object.entries(LOCKED)) {
      assert.equal(sha256(file), expected, file);
    }
  });
});

describe("My Tournaments navigation + route auth", () => {
  it("PLAYER menu includes Giải của tôi → /tournaments without TOURNAMENT_UPDATE", () => {
    const player = playerUser();
    const auth = {
      can: (perm, scope) => can(player, perm, scope, { rbacEnabled: true }),
      rbacEnabled: true,
      isAuthenticated: true,
      user: player,
    };
    const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, auth, {
      clubId: "club-1",
      venueId: "venue-a",
      playerId: "p-1",
    });
    const labels = collectMenuItemLabels(visible);
    assert.ok(labels.includes("Giải của tôi"));
    assert.equal(TOURNAMENT_ROUTES.dashboard, "/tournaments");
    assert.deepEqual(getRouteAccessPermissions("/tournaments"), []);
  });

  it("authenticated hub requires login; Dashboard id path stays auth shell", () => {
    const opts = { authProductionEnabled: true, rbacEnabled: true };
    assert.equal(isMyTournamentsHubPath("/tournaments"), true);
    assert.equal(isPublicAuthPath("/tournaments", opts), false);
    assert.equal(
      shouldRedirectToLogin("/tournaments", { ...opts, isAuthenticated: false }),
      true
    );
    assert.equal(isAuthenticatedOnlyRoute("/tournaments"), true);
    assert.equal(
      isAuthenticatedOnlyRoute("/tournaments/7d1fe5a0-f312-4e4e-9869-53eff9383c54"),
      true
    );
  });
});

describe("My Tournaments list projection + visibility parity matrix", () => {
  it("projects captain card with dashboard + captain portal hrefs (no activeClub)", () => {
    const card = projectMyDashboardCard({
      id: "7d1fe5a0-f312-4e4e-9869-53eff9383c54",
      name: "Owner draft",
      status: "draft",
      clubId: "club-a",
      roles: ["captain", "participant"],
      myTeam: { id: "team-a", name: "Đội 1" },
      openTaskCount: 2,
      href: "/tournaments/7d1fe5a0-f312-4e4e-9869-53eff9383c54",
      captainPortalHref:
        "/team-portal/7d1fe5a0-f312-4e4e-9869-53eff9383c54?club=club-a",
    });
    assert.equal(card.href, "/tournaments/7d1fe5a0-f312-4e4e-9869-53eff9383c54");
    assert.match(card.captainPortalHref, /\/team-portal\/7d1fe5a0/);
    assert.match(card.captainPortalHref, /club=club-a/);
    assert.deepEqual(roleLabelsVi(card.roles), ["Đội trưởng", "Thành viên"]);
  });

  it("server denial stays denial; authorized list maps cards", () => {
    const denied = normalizeMyDashboardListResult({
      ok: false,
      code: "CROSS_TENANT_DENIED",
    });
    assert.equal(denied.ok, false);
    assert.match(denied.error, /tenant khác/i);

    const ok = normalizeMyDashboardListResult({
      ok: true,
      tournaments: [
        {
          id: "tid-1",
          name: "A",
          status: "draft",
          roles: ["referee"],
          refereeHref: "/team-referee/tid-1",
        },
        {
          id: "tid-2",
          name: "B",
          status: "active",
          roles: ["viewer"],
        },
      ],
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.tournaments.length, 2);
    assert.equal(ok.tournaments[0].href, "/tournaments/tid-1");
    assert.equal(ok.tournaments[0].refereeHref, "/team-referee/tid-1");
  });

  it("local Dashboard visibility matrix matches required draft policy", () => {
    const draft = { status: "draft" };
    assert.equal(
      canViewTournamentDashboard({
        tournament: draft,
        isAuthenticated: true,
        canOrganize: true,
        sameTenant: true,
      }).ok,
      true
    );
    assert.equal(
      canViewTournamentDashboard({
        tournament: draft,
        isAuthenticated: true,
        canOrganize: false,
        sameTenant: true,
        hasDraftOperationalRole: true,
      }).ok,
      true
    );
    assert.equal(
      canViewTournamentDashboard({
        tournament: draft,
        isAuthenticated: true,
        canOrganize: false,
        sameTenant: true,
        hasDraftOperationalRole: false,
      }).code,
      "DRAFT_NOT_VISIBLE"
    );
    assert.equal(
      canViewTournamentDashboard({
        tournament: { status: "active" },
        isAuthenticated: true,
        canOrganize: false,
        sameTenant: true,
      }).ok,
      true
    );
    assert.equal(
      canViewTournamentDashboard({
        tournament: { status: "active" },
        isAuthenticated: true,
        canOrganize: false,
        sameTenant: false,
      }).code,
      "CROSS_TENANT_DENIED"
    );
  });
});
