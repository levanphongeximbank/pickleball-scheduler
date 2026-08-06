import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  evaluateSkillAssessmentV5PageAccess,
  evaluateSkillAssessmentV5RouteAccess,
  evaluateSkillAssessmentV5SyncAccess,
  isSkillAssessmentV5AdminRole,
  isSkillAssessmentV5Path,
  SKILL_ASSESSMENT_V5_PATH,
} from "../src/features/pick-vn-rating-v5/services/skillAssessmentV5RouteAccess.js";
import { B03_SHADOW_SKILL_ASSESSMENT_V5 } from "../src/features/canonical-shell/config/ownerDecisions.js";
import { buildCanonicalMenuTree } from "../src/features/canonical-shell/config/canonicalMenuRegistry.js";
import {
  filterCanonicalMenu,
  flattenCanonicalMenu,
} from "../src/features/canonical-shell/services/filterCanonicalMenu.js";
import { buildCanonicalSearchIndex } from "../src/features/canonical-shell/services/buildCanonicalSearchIndex.js";
import { MENU_GROUPS, MOBILE_BOTTOM_NAV_PROFILES } from "../src/config/navigationConfig.js";
import { isAuthenticatedOnlyRoute, isPublicAuthPath } from "../src/auth/authGuard.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function authFor(role) {
  return {
    user: { id: "u1", role },
    rbacEnabled: true,
    permissions: ["*"],
    hasPermission: () => true,
    isAuthenticated: true,
  };
}

test("phase4 B03 — path helpers and admin roles", () => {
  assert.equal(isSkillAssessmentV5Path(SKILL_ASSESSMENT_V5_PATH), true);
  assert.equal(isSkillAssessmentV5Path("/player/skill-assessment"), false);
  assert.equal(isSkillAssessmentV5AdminRole("SUPER_ADMIN"), true);
  assert.equal(isSkillAssessmentV5AdminRole("PLATFORM_ADMIN"), true);
  assert.equal(isSkillAssessmentV5AdminRole("PLAYER"), false);
  assert.equal(isSkillAssessmentV5AdminRole("VENUE_OWNER"), false);
});

test("phase4 B03 — sync role matrix (guard)", () => {
  assert.equal(evaluateSkillAssessmentV5SyncAccess({ user: null }).decision, "deny");
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "a", role: "SUPER_ADMIN" },
      flagEnabled: false,
    }).decision,
    "allow"
  );
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "a", role: "PLATFORM_ADMIN" },
      flagEnabled: false,
    }).decision,
    "allow"
  );
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "p", role: "PLAYER" },
      flagEnabled: false,
    }).decision,
    "controlled_unavailable"
  );
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "p", role: "PLAYER" },
      flagEnabled: true,
    }).decision,
    "needs_enrollment"
  );
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "v", role: "VENUE_OWNER" },
      flagEnabled: true,
    }).decision,
    "deny"
  );
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "c", role: "COACH" },
      flagEnabled: true,
    }).code,
    "FORBIDDEN_ROLE"
  );
  assert.equal(
    evaluateSkillAssessmentV5SyncAccess({
      user: { id: "u", role: "NOT_A_REAL_ROLE" },
      flagEnabled: true,
    }).decision,
    "deny"
  );
});

test("phase4 B03 — page access must not re-block admin when flag OFF (BR-B03-01)", () => {
  assert.deepEqual(
    evaluateSkillAssessmentV5PageAccess({
      user: { id: "a", role: "SUPER_ADMIN" },
      flagEnabled: false,
    }),
    { allowed: true, code: "ADMIN_TECH_EVAL" }
  );
  assert.deepEqual(
    evaluateSkillAssessmentV5PageAccess({
      user: { id: "a", role: "PLATFORM_ADMIN" },
      flagEnabled: false,
    }),
    { allowed: true, code: "ADMIN_TECH_EVAL" }
  );
  assert.deepEqual(
    evaluateSkillAssessmentV5PageAccess({
      user: { id: "p", role: "PLAYER" },
      flagEnabled: false,
    }),
    { allowed: false, code: "FEATURE_DISABLED" }
  );
  assert.deepEqual(
    evaluateSkillAssessmentV5PageAccess({
      user: { id: "p", role: "PLAYER" },
      flagEnabled: true,
    }),
    { allowed: null, code: "NEEDS_ENROLLMENT_CHECK" }
  );
  assert.deepEqual(
    evaluateSkillAssessmentV5PageAccess({
      user: { id: "v", role: "VENUE_OWNER" },
      flagEnabled: true,
    }),
    { allowed: false, code: "FORBIDDEN_ROLE" }
  );
  assert.deepEqual(
    evaluateSkillAssessmentV5PageAccess({
      user: { id: "u", role: "UNKNOWN_ROLE_XYZ" },
      flagEnabled: true,
    }),
    { allowed: false, code: "FORBIDDEN_ROLE" }
  );
});

test("phase4 B03 — async route access: PLAYER enrollment gate uses Rating V5 authority", async () => {
  // Without enrollment service seed, PLAYER + flag ON should deny (fail closed / not enrolled).
  const denied = await evaluateSkillAssessmentV5RouteAccess({
    user: { id: "p", role: "PLAYER" },
    flagEnabled: true,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.decision, "deny");

  const admin = await evaluateSkillAssessmentV5RouteAccess({
    user: { id: "a", role: "SUPER_ADMIN" },
    flagEnabled: false,
  });
  assert.equal(admin.ok, true);
  assert.equal(admin.decision, "allow");
});

test("phase4 B03 — hidden from canonical menu/search and legacy nav writers", () => {
  for (const role of ["SUPER_ADMIN", "PLAYER", "VENUE_OWNER"]) {
    const leaves = flattenCanonicalMenu(
      filterCanonicalMenu(authFor(role), { viewport: "desktop" })
    );
    assert.equal(leaves.some((n) => n.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
    const hits = buildCanonicalSearchIndex(authFor(role));
    assert.equal(hits.some((h) => h.path === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
  }

  const menuSrc = JSON.stringify(MENU_GROUPS);
  assert.equal(menuSrc.includes(SKILL_ASSESSMENT_V5_PATH), false);
  const mobileSrc = JSON.stringify(MOBILE_BOTTOM_NAV_PROFILES);
  assert.equal(mobileSrc.includes(SKILL_ASSESSMENT_V5_PATH), false);

  assert.equal(isAuthenticatedOnlyRoute(SKILL_ASSESSMENT_V5_PATH), false);
  assert.equal(
    isPublicAuthPath(SKILL_ASSESSMENT_V5_PATH, {
      authProductionEnabled: true,
      rbacEnabled: true,
    }),
    false
  );
});

test("phase4 B03 — router mounts SkillAssessmentV5RouteGuard; page uses page-access helper", () => {
  const router = readFileSync(join(root, "src/router.jsx"), "utf8");
  assert.match(router, /SkillAssessmentV5RouteGuard/);
  assert.match(router, /path="\/player\/skill-assessment-v5"/);

  const page = readFileSync(join(root, "src/pages/player/SkillAssessmentV5Page.jsx"), "utf8");
  assert.match(page, /evaluateSkillAssessmentV5PageAccess/);
  assert.equal(page.includes("FEATURE_DISABLED") && page.includes("isSkillAssessmentV5AdminRole"), false);
});

test("phase4 B03 — registry tree never lists shadow route", () => {
  const flat = flattenCanonicalMenu(buildCanonicalMenuTree());
  assert.equal(flat.some((n) => n.route === B03_SHADOW_SKILL_ASSESSMENT_V5), false);
});
