import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadAIData } from "../src/ai/storage.js";
import { assertExplicitClubId } from "../src/features/club/context/requireExplicitClubId.js";
import {
  hasExplicitDashboardClubId,
  loadClubOperationsDashboardSummary,
} from "../src/pages/dashboard.logic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("wave-o3-dashboard-club-required-remediation-01", () => {
  it("1 hydrated explicit clubId loads club-operations summary without throw", () => {
    const clubId = "club-dashboard-o3-remediation";
    let queriedClubId = null;
    const result = loadClubOperationsDashboardSummary({
      clubId,
      loadAIData: (id) => {
        queriedClubId = id;
        return { sessions: [] };
      },
      loadPlayers: () => [],
      loadCourts: () => [],
      loadRounds: () => [],
    });
    assert.equal(result.ok, true);
    assert.equal(result.queried, true);
    assert.equal(result.clubId, clubId);
    assert.equal(queriedClubId, clubId);
    assert.ok(result.summary?.totals);
  });

  it("2-3 pre-hydration / no club does not call club-scoped query; safe gate", () => {
    let queryCount = 0;
    const loaders = {
      loadAIData: () => {
        queryCount += 1;
        return { sessions: [] };
      },
      loadPlayers: () => {
        queryCount += 1;
        return [];
      },
      loadCourts: () => {
        queryCount += 1;
        return [];
      },
      loadRounds: () => {
        queryCount += 1;
        return [];
      },
    };

    for (const clubId of [null, undefined, "", "   "]) {
      const result = loadClubOperationsDashboardSummary({ clubId, ...loaders });
      assert.equal(result.ok, false);
      assert.equal(result.code, "CLUB_REQUIRED");
      assert.equal(result.queried, false);
      assert.equal(result.summary, null);
    }
    assert.equal(queryCount, 0);
    assert.equal(hasExplicitDashboardClubId(null), false);
    assert.equal(hasExplicitDashboardClubId("club-a"), true);

    const dashboardSrc = readFileSync(path.join(root, "src/pages/Dashboard.jsx"), "utf8");
    assert.ok(dashboardSrc.includes("hasExplicitDashboardClubId"));
    assert.ok(dashboardSrc.includes("resolveDashboardClubOperationsGate"));
    assert.ok(
      dashboardSrc.includes("dashboard-club-operations-placeholder") ||
        dashboardSrc.includes("dashboard-club-operations-gate")
    );
    assert.ok(dashboardSrc.includes("Đang tải ngữ cảnh CLB"));
    assert.ok(dashboardSrc.includes("loadClubOperationsDashboardSummary"));
    assert.equal(dashboardSrc.includes("clubs[0]"), false);
    assert.equal(dashboardSrc.includes("getActiveClubId()"), false);
  });

  it("4 club-scoped query without explicit clubId still fails closed", () => {
    assert.throws(
      () => assertExplicitClubId(""),
      (error) => error?.name === "ClubContextError" && error?.code === "CLUB_REQUIRED"
    );
    assert.throws(
      () => loadAIData(undefined),
      (error) =>
        error?.name === "ClubContextError" &&
        String(error?.message || "").includes("CLUB_REQUIRED")
    );
  });

  it("5-7 no clubs[0] / tenantId-as-clubId fallback; selected clubId passed explicitly", () => {
    const logicSrc = readFileSync(path.join(root, "src/pages/dashboard.logic.js"), "utf8");
    assert.equal(logicSrc.includes("clubs[0]"), false);
    assert.equal(logicSrc.includes("tenantId as clubId"), false);
    assert.ok(logicSrc.includes("hasExplicitDashboardClubId"));

    let seen = null;
    loadClubOperationsDashboardSummary({
      clubId: "  canonical-club-9  ",
      loadAIData: (id) => {
        seen = id;
        return { sessions: [] };
      },
      loadPlayers: () => [],
      loadCourts: () => [],
      loadRounds: () => [],
    });
    assert.equal(seen, "canonical-club-9");

    // tenantId must not be treated as clubId by the gate helper
    assert.equal(hasExplicitDashboardClubId(""), false);
    const storageSrc = readFileSync(path.join(root, "src/ai/storage.js"), "utf8");
    assert.ok(storageSrc.includes("assertExplicitClubId"));
    assert.equal(storageSrc.includes("getActiveClubId()"), false);
  });
});
