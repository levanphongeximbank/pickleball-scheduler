import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FEATURE_FLAG_KEYS,
  isPrivatePairingRulesEnabled,
  isPrivatePairingSimulationEnabled,
} from "../src/features/private-pairing-rules/constants/codes.js";
import {
  canAuditPrivatePairingRules,
  canManagePrivatePairingRules,
  canSimulatePrivatePairingRules,
  canViewPrivatePairingRules,
  PRIVATE_PAIRING_UI_PERMISSIONS,
  privatePairingForbiddenResult,
} from "../src/features/private-pairing-rules/ui/privatePairingPermissions.js";
import {
  CONSTRAINT_TYPE_GROUPS,
  CONSTRAINT_TYPE_LABELS,
} from "../src/features/private-pairing-rules/ui/privatePairingAdminHelpers.js";
import * as adminApi from "../src/features/private-pairing-rules/ui/privatePairingAdminApi.js";
import { ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import { ADMIN_MENU_ROOT } from "../src/config/v5Menu/adminMenu.js";
import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../src/features/private-pairing-rules/index.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_SIMULATION]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_SIMULATION]: "false",
};

test("feature flags default OFF for pairing and simulation", () => {
  assert.equal(isPrivatePairingRulesEnabled(FLAGS_OFF), false);
  assert.equal(isPrivatePairingSimulationEnabled(FLAGS_OFF), false);
  assert.equal(isPrivatePairingRulesEnabled(FLAGS_ON), true);
  assert.equal(isPrivatePairingSimulationEnabled(FLAGS_ON), true);
});

test("permission helpers refuse when private pairing flag OFF", () => {
  const user = { id: "u1", role: "SUPER_ADMIN", permissions: Object.values(PRIVATE_PAIRING_UI_PERMISSIONS) };
  assert.equal(canViewPrivatePairingRules(user, { envSource: FLAGS_OFF, rbacEnabled: true }), false);
  assert.equal(canManagePrivatePairingRules(user, { envSource: FLAGS_OFF, rbacEnabled: true }), false);
  assert.equal(canAuditPrivatePairingRules(user, { envSource: FLAGS_OFF, rbacEnabled: true }), false);
  assert.equal(canSimulatePrivatePairingRules(user, { envSource: FLAGS_OFF, rbacEnabled: true }), false);
});

test("forbidden helper returns 403_FORBIDDEN", () => {
  const result = privatePairingForbiddenResult();
  assert.equal(result.ok, false);
  assert.equal(result.code, "403_FORBIDDEN");
});

test("admin menu leaf has permission + requiresFeature gating", () => {
  const leaf = (ADMIN_MENU_ROOT.children || []).find(
    (item) => item.key === "admin-private-pairing-rules"
  );
  assert.ok(leaf);
  assert.equal(leaf.path, "/admin/ai-pairing/private-rules");
  assert.equal(leaf.text, "Quy tắc ghép cặp riêng");
  assert.ok(leaf.permissions?.includes("pairing.private_rules.view"));
  assert.equal(leaf.requiresFeature, "privatePairingRules");
});

test("route permissions require pairing.private_rules.view", () => {
  assert.deepEqual(ROUTE_PERMISSIONS["/admin/ai-pairing/private-rules"], [
    "pairing.private_rules.view",
  ]);
});

test("Vietnamese constraint labels match PR-5 copy", () => {
  assert.equal(
    CONSTRAINT_TYPE_LABELS[PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER],
    "Tuyệt đối không đứng cùng"
  );
  assert.equal(
    CONSTRAINT_TYPE_LABELS[PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT],
    "Ưu tiên đối đầu"
  );
  assert.ok(CONSTRAINT_TYPE_GROUPS.length >= 4);
});

test("admin API exposes simulation + conflict helpers", () => {
  assert.equal(typeof adminApi.simulatePrivatePairing, "function");
  assert.equal(typeof adminApi.detectPrivatePairingConflicts, "function");
  assert.equal(typeof adminApi.isPrivatePairingSimulationEnabled, "function");
  assert.equal(typeof adminApi.canSimulatePrivatePairingRules, "function");
});

test("simulation panel source has no Apply-to-live button", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "src/features/private-pairing-rules/components/panels/PrivatePairingSimulationPanel.jsx"
    ),
    "utf8"
  );
  assert.equal(/Áp dụng vào giải|Apply to live|Ghi vào lineup|Tạo trận/.test(source), false);
  assert.match(source, /Mô phỏng — chưa áp dụng/);
  assert.match(source, /simulatePrivatePairing/);
});

test("admin view composes panel modules", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "src/features/private-pairing-rules/components/PrivatePairingRulesAdminView.jsx"
    ),
    "utf8"
  );
  assert.match(source, /PrivatePairingRuleSetList/);
  assert.match(source, /PrivatePairingConflictPanel/);
  assert.match(source, /PrivatePairingSimulationPanel/);
  assert.match(source, /PrivatePairingAuditLog/);
  assert.match(source, /PrivatePairingVersionHistory/);
  assert.match(source, /403_FORBIDDEN/);
  assert.equal(/runPrivatePairingRuntime/.test(source), false);
});

test("router guards private-rules with SuperAdminRouteGuard", () => {
  const source = readFileSync(join(process.cwd(), "src/router.jsx"), "utf8");
  assert.match(source, /\/admin\/ai-pairing\/private-rules/);
  assert.match(source, /SuperAdminRouteGuard/);
  assert.match(source, /PrivatePairingRulesAdminPage/);
});
