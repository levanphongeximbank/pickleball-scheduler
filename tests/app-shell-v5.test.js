import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { APP_VERSION_LABEL } from "../src/config/appVersion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("app shell — version label V5.0 SaaS Preview RC1", () => {
  assert.equal(APP_VERSION_LABEL, "V5.0 SaaS Preview RC1");
});

test("app shell — header không còn legacy chips tiếng Anh", () => {
  const header = readSrc("src/components/Header.jsx");

  assert.equal(/AI Ready/.test(header), false);
  assert.equal(/CommandChip/.test(header), false);
  assert.equal(/label=\{user\.role\}/.test(header), false);
  assert.equal(/Workflow notifications/.test(header), false);
  assert.ok(header.includes("AccountMenu"));
  assert.ok(header.includes('variant="light"'));
});

test("app shell — context bar chỉ hiển thị switchers gọn trên desktop", () => {
  const contextBar = readSrc("src/components/shell/AppContextBar.jsx");

  assert.ok(contextBar.includes("ClubSwitcher"));
  assert.ok(contextBar.includes("SeasonLeagueSwitcher"));
  assert.equal(/AI sẵn sàng/.test(contextBar), false);
});

test("app shell — sidebar slate + footer cơ sở", () => {
  const sidebar = readSrc("src/components/Sidebar.jsx");

  assert.ok(sidebar.includes("SidebarFooter"));
  assert.ok(sidebar.includes('variant="dark"'));
  assert.ok(sidebar.includes("shellTokens"));
});

test("app shell — main layout wires OperationalRouteGate", () => {
  const layout = readSrc("src/layouts/MainLayout.jsx");

  assert.ok(layout.includes("OperationalRouteGate"));
  assert.equal(/SubscriptionGate/.test(layout), false);
});

test("app shell — main layout có context bar và page background", () => {
  const layout = readSrc("src/layouts/MainLayout.jsx");

  assert.ok(layout.includes("AppContextBar"));
  assert.ok(layout.includes("pageBg"));
});

test("app shell — global search Ctrl K shortcut", () => {
  const search = readSrc("src/components/GlobalSearch.jsx");

  assert.ok(search.includes("Ctrl K"));
  assert.equal(/⌘/.test(search), false);
  assert.ok(search.includes('event.key.toLowerCase() === "k"'));
});

test("app shell — global search không crash khi InputProps undefined (MUI v9)", () => {
  const search = readSrc("src/components/GlobalSearch.jsx");

  assert.equal(/params\.InputProps\.endAdornment/.test(search), false);
  assert.ok(search.includes("params.InputProps ?? {}"));
});

test("app shell — không còn label legacy trong navigation config", () => {
  const nav = readSrc("src/config/navigationConfig.js");

  assert.equal(/label:\s*"Dashboard"/.test(nav), false);
  assert.equal(/label:\s*"AI Assistant"/.test(nav), false);
  assert.equal(/AI Director Platform/.test(nav), false);
  assert.equal(/text:\s*"USERS"/.test(nav), false);
  assert.equal(/text:\s*"Của tôi"/.test(nav), false);
  assert.equal(/v3\.5\.3/.test(nav), false);
});

test("app shell — account menu dùng ROLE_LABELS tiếng Việt", () => {
  const account = readSrc("src/components/shell/AccountMenu.jsx");

  assert.ok(account.includes("ROLE_LABELS"));
  assert.ok(account.includes("Chủ sân") || account.includes("ROLE_SUBTITLES"));
  assert.equal(/label=\{user\.role\}/.test(account), false);
});

test("app shell — design tokens V5 slate enterprise", () => {
  const tokens = readSrc("src/theme/designTokens.js");

  assert.ok(tokens.includes('DESIGN_DIRECTION = "slate-enterprise"'));
  assert.ok(tokens.includes("#0F172A"));
  assert.ok(tokens.includes("#10B981"));
  assert.ok(tokens.includes("DM Sans"));
});

test("app shell — MUI theme aligned with design tokens", () => {
  const theme = readSrc("src/theme/theme.js");

  assert.ok(theme.includes("designTokens"));
  assert.ok(theme.includes("PALETTE.primary"));
  assert.equal(/#1976d2/.test(theme), false);
});

test("app shell — login split layout V5", () => {
  const login = readSrc("src/pages/LoginPage.jsx");

  assert.ok(login.includes("SHELL_COLORS.sidebarBg"));
  assert.ok(login.includes("FeatureBullet"));
});

test("app shell — dashboard header Tổng quan", () => {
  const dashboard = readSrc("src/features/dashboard-analytics/components/DashboardAnalyticsView.jsx");

  assert.ok(dashboard.includes("Tổng quan"));
  assert.equal(/Dashboard Analytics/.test(dashboard), false);
  assert.ok(dashboard.includes("DashboardTodayKpis"));
});
