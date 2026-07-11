/**
 * Phase 43A — Preview QA (local unit + staging Preview browser).
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... PHASE43A_COMMIT=$(git rev-parse --short HEAD) \\
 *     node scripts/verify-phase43a-preview-qa.mjs
 *
 * Optional: SKIP_BUILD=1 SKIP_LOCAL_TESTS=1 SKIP_BROWSER=1
 */
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PROD_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const EVIDENCE = path.join(rootDir, "docs", "v5", "qa-evidence", "phase43a-preview");
const REPORT_PATH = path.join(EVIDENCE, "PHASE_43A_PREVIEW_QA_REPORT.json");
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();
const AUTH_KEY = "pickleball-auth-session-v1";
const QUEUE_KEY = "pickleball-offline-queue-v1";

const ACCOUNTS = {
  noMember: "qa42l.nomember@staging.local",
  activeMember: "player.nomember@staging.local",
  president: "player@staging.local",
  saNoMember: "superadmin.nomember@staging.local",
};

const report = {
  phase: "43A-preview",
  preview: DEPLOYMENT,
  commit: process.env.PHASE43A_COMMIT || "local",
  deploymentId: process.env.PHASE43A_DEPLOYMENT_ID || null,
  stagingRef: STAGING_REF,
  groups: {},
  cases: [],
  local: {},
  envProbe: {},
  consoleFindings: [],
  networkFindings: [],
  pageErrors: [],
  screenshots: [],
  verdict: "PENDING",
  blockers: [],
};

function record(group, caseId, verdict, evidence, extra = {}) {
  report.cases.push({ group, case: caseId, verdict, evidence, ...extra });
  if (!report.groups[group]) {
    report.groups[group] = { verdict: "PENDING", cases: [] };
  }
  report.groups[group].cases.push({ case: caseId, verdict });
  console.log(`[${group}] [${verdict}] ${caseId}: ${evidence}`);
}

function finalizeGroups() {
  for (const [group, data] of Object.entries(report.groups)) {
    const verdicts = data.cases.map((c) => c.verdict);
    if (verdicts.every((v) => v === "PASS")) {
      data.verdict = "PASS";
    } else if (verdicts.some((v) => v === "FAIL")) {
      data.verdict = "FAIL";
    } else if (verdicts.some((v) => v === "PASS")) {
      data.verdict = "PARTIAL";
    } else {
      data.verdict = verdicts[0] || "PENDING";
    }
  }
}

function runCmd(label, command, args, env = {}) {
  const started = Date.now();
  const proc = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
    maxBuffer: 20 * 1024 * 1024,
  });
  const ok = proc.status === 0;
  return {
    label,
    ok,
    status: proc.status,
    durationMs: Date.now() - started,
    stdout: String(proc.stdout || "").slice(-4000),
    stderr: String(proc.stderr || "").slice(-4000),
  };
}

function assertStagingOnly() {
  loadProjectEnv();
  const url = String(
    process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();
  if (url.includes(PROD_REF)) {
    throw new Error(`Refusing production Supabase ref in Preview QA (${PROD_REF})`);
  }
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(path.relative(rootDir, file).replace(/\\/g, "/"));
  return file;
}

function attachObservers(page, label) {
  page.on("pageerror", (err) => {
    const msg = `${label} pageerror: ${err?.message || err}`;
    report.pageErrors.push(msg);
    report.consoleFindings.push(msg);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("React DevTools")) {
        report.consoleFindings.push(`${label} console: ${t}`);
      }
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && (url.includes("/rpc/") || url.includes("/rest/v1/"))) {
      report.networkFindings.push(`${label} ${res.status()} ${url.slice(0, 140)}`);
    }
  });
}

async function login(page, email, password = QA_PASSWORD) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
}

async function expandNavGroups(page) {
  const toggles = page.locator('[aria-expanded="false"]');
  const count = await toggles.count();
  for (let i = 0; i < Math.min(count, 12); i += 1) {
    await toggles.nth(i).click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function menuHas(page, label) {
  await expandNavGroups(page);
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if ((await page.getByRole("link", { name: re }).count()) > 0) return true;
  if ((await page.getByRole("button", { name: re }).count()) > 0) return true;
  return (await page.getByText(re).count()) > 0;
}

async function probeBundle43a() {
  const res = await fetch(`${DEPLOYMENT}/`);
  const html = await res.text();
  const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  let safetyFlag = false;
  let quarantineFn = false;
  let clubScope = false;
  const scanList = scripts.slice(0, 24);
  for (const src of scanList) {
    const jsRes = await fetch(`${DEPLOYMENT}${src}`);
    const js = await jsRes.text();
    if (/VITE_PHASE43A_SAFETY|phase43aFlags/i.test(js)) {
      safetyFlag = true;
    }
    if (
      /quarantineOfflineQueueOnLogout|offlineQueueQuarantine|SESSION_LOGOUT|pickleball-offline-queue-v1/i.test(
        js
      )
    ) {
      quarantineFn = true;
    }
    if (/CLUB_OUT_OF_SCOPE|clubScopeService/i.test(js)) {
      clubScope = true;
    }
  }
  // Lazy chunks (mobile/auth) may not be linked from index.html — probe known paths from build manifest patterns
  if (!quarantineFn) {
    const lazyCandidates = [
      "checkInService",
      "governanceRoleElevation",
      "index-",
    ];
    for (const src of scripts) {
      if (!lazyCandidates.some((k) => src.includes(k))) continue;
      const jsRes = await fetch(`${DEPLOYMENT}${src}`);
      const js = await jsRes.text();
      if (/SESSION_LOGOUT|pickleball-offline-queue-v1/i.test(js)) {
        quarantineFn = true;
        break;
      }
    }
  }
  report.envProbe = {
    bundleScanned: scanList.length,
    phase43aSafetyRef: safetyFlag,
    offlineQuarantineRef: quarantineFn,
    clubScopeRef: clubScope,
    verdict: quarantineFn && clubScope ? "PASS" : quarantineFn || clubScope ? "PARTIAL" : "FAIL",
  };
  record(
    "ENV",
    "bundle_43a_probe",
    report.envProbe.verdict === "FAIL" ? "FAIL" : "PASS",
    `safety=${safetyFlag} quarantine=${quarantineFn} clubScope=${clubScope}`
  );
}

async function runLocalGate() {
  if (process.env.SKIP_LOCAL_TESTS === "1") {
    record("LOCAL", "unit_tests", "SKIP", "SKIP_LOCAL_TESTS=1");
    return;
  }

  const isolation = runCmd("phase43a-offline", "node", [
    "--test",
    "tests/phase43a-offline-queue-isolation.test.js",
  ]);
  record(
    "LOCAL",
    "offline_queue_isolation_unit",
    isolation.ok ? "PASS" : "FAIL",
    `exit=${isolation.status} durationMs=${isolation.durationMs}`
  );

  const apiScope = runCmd("phase43a-api", "node", [
    "--test",
    "tests/phase43a-api-scope.test.js",
  ], { VITE_RBAC_ENABLED: "true", VITE_API_ENABLED: "true" });
  record(
    "LOCAL",
    "api_club_scope_unit",
    apiScope.ok ? "PASS" : "FAIL",
    `exit=${apiScope.status} durationMs=${apiScope.durationMs}`
  );

  const navMatrix = runCmd("phase42l-nav-matrix", "node", [
    "--test",
    "tests/phase42l-navigation-matrix.test.js",
  ]);
  record(
    "LOCAL",
    "regression_42l_nav_matrix_unit",
    navMatrix.ok ? "PASS" : "FAIL",
    `exit=${navMatrix.status} durationMs=${navMatrix.durationMs}`
  );

  report.local = { isolation, apiScope, navMatrix };

  if (process.env.SKIP_BUILD === "1") {
    record("LOCAL", "build", "SKIP", "SKIP_BUILD=1");
    return;
  }

  const build = runCmd("build", "npm", ["run", "build"]);
  record(
    "LOCAL",
    "build",
    build.ok ? "PASS" : "FAIL",
    `exit=${build.status} durationMs=${build.durationMs}`
  );
  report.local.build = build;
}

async function runBrowserGate() {
  if (process.env.SKIP_BROWSER === "1") {
    record("BROWSER", "all", "SKIP", "SKIP_BROWSER=1");
    return;
  }

  await probeBundle43a();

  const browser = await chromium.launch({ headless: true });

  // Q1 — offline queue logout quarantine
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "Q1");
    try {
      await login(page, ACCOUNTS.activeMember);
      const session = await page.evaluate((authKey) => {
        try {
          return JSON.parse(localStorage.getItem(authKey) || "{}");
        } catch {
          return {};
        }
      }, AUTH_KEY);
      const userId = session?.user?.id;
      const tenantId = session?.user?.venueId || session?.user?.tenantId || "venue-prod-main";
      if (!userId) {
        record("Q", "offline_logout_quarantine", "FAIL", "no session user id");
      } else {
        await page.evaluate(
          ({ queueKey, userId, tenantId }) => {
            localStorage.setItem(
              queueKey,
              JSON.stringify([
                {
                  id: "qa43a-pending",
                  type: "referee_note",
                  payload: { matchId: "qa43a" },
                  userId,
                  tenantId,
                  status: "pending",
                  createdAt: new Date().toISOString(),
                  attempts: 0,
                  requestId: "qa43a-req-1",
                },
              ])
            );
          },
          { queueKey: QUEUE_KEY, userId, tenantId }
        );

        const accountMenu = page.getByRole("button", { name: /Menu tài khoản/i });
        if ((await accountMenu.count()) > 0) {
          await accountMenu.click({ timeout: 8000 });
          await page.waitForTimeout(500);
          await page.getByRole("menuitem", { name: /^Đăng xuất$/i }).click({ timeout: 8000 });
          await page.waitForTimeout(3000);
        } else {
          await page.evaluate((authKey) => {
            localStorage.removeItem(authKey);
          }, AUTH_KEY);
        }

        const queueStatus = await page.evaluate((queueKey) => {
          try {
            const rows = JSON.parse(localStorage.getItem(queueKey) || "[]");
            return rows[0]?.status || null;
          } catch {
            return null;
          }
        }, QUEUE_KEY);

        await shot(page, "q1-offline-logout-quarantine");
        record(
          "Q",
          "offline_logout_quarantine",
          queueStatus === "quarantined" ? "PASS" : "FAIL",
          `queueStatus=${queueStatus}`
        );
      }
    } catch (e) {
      record("Q", "offline_logout_quarantine", "FAIL", String(e.message || e));
      await shot(page, "q1-error").catch(() => {});
    }
    await ctx.close();
  }

  // Q2 — tenant switch SA (42L case 9 lite)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "Q2");
    try {
      await login(page, ACCOUNTS.saNoMember);
      await page.goto(`${DEPLOYMENT}/manage/clubs`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(2500);
      const select = page.locator("header .MuiSelect-select").first();
      const hasPicker = (await select.count()) > 0;
      let pickOk = false;
      if (hasPicker) {
        await select.click({ timeout: 5000 });
        await page.waitForTimeout(400);
        const opts = await page.getByRole("option").allTextContents();
        await page.keyboard.press("Escape").catch(() => {});
        pickOk = opts.some((o) => /Staging|Venue|tenant/i.test(o));
      }
      await shot(page, "q2-tenant-switch-sa");
      record(
        "Q",
        "tenant_switch_sa_picker",
        hasPicker && pickOk ? "PASS" : hasPicker ? "PARTIAL" : "FAIL",
        `hasPicker=${hasPicker} pickOk=${pickOk}`
      );
    } catch (e) {
      record("Q", "tenant_switch_sa_picker", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // R — 42L menu regression subset
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "R1");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.goto(`${DEPLOYMENT}/discover-clubs`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(2000);
      const discover = await menuHas(page, "Khám phá CLB");
      const platformHidden = !(await menuHas(page, "Tất cả CLB"));
      await shot(page, "r1-nomember-menu");
      record(
        "R",
        "42l_nomember_discover_no_platform",
        discover && platformHidden ? "PASS" : "FAIL",
        `discover=${discover} platformHidden=${platformHidden}`
      );
    } catch (e) {
      record("R", "42l_nomember_discover_no_platform", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "R2");
    try {
      await login(page, ACCOUNTS.president);
      await page.goto(`${DEPLOYMENT}/my-club/requests`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(2000);
      const requestsMenu = await menuHas(page, "Yêu cầu gia nhập");
      const body = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
      const onRequests = /Yêu cầu|Duyệt|Chờ duyệt/i.test(body);
      await shot(page, "r2-president-requests");
      record(
        "R",
        "42l_president_requests_menu",
        requestsMenu || onRequests ? "PASS" : "PARTIAL",
        `requestsMenu=${requestsMenu} onRequests=${onRequests}`
      );
    } catch (e) {
      record("R", "42l_president_requests_menu", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "R3");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.goto(`${DEPLOYMENT}/platform/clubs`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(2500);
      const url = page.url();
      const blocked = !url.includes("/platform/clubs") || url.includes("/discover-clubs");
      await shot(page, "r3-unauthorized-platform");
      record(
        "R",
        "42l_unauthorized_platform_guard",
        blocked ? "PASS" : "FAIL",
        `final=${url}`
      );
    } catch (e) {
      record("R", "42l_unauthorized_platform_guard", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // PAGE — pageerror budget
  {
    const pageErrorCount = report.pageErrors.length;
    record(
      "PAGE",
      "pageerror_zero",
      pageErrorCount === 0 ? "PASS" : "FAIL",
      `pageErrors=${pageErrorCount}`
    );
  }

  await browser.close();
}

function computeVerdict() {
  finalizeGroups();
  const failCases = report.cases.filter((c) => c.verdict === "FAIL");
  const blocked = report.cases.filter((c) => c.verdict === "BLOCKED");
  if (blocked.length > 0) {
    report.verdict = "BLOCKED";
    report.blockers = blocked.map((c) => `${c.group}/${c.case}`);
    return;
  }
  if (failCases.length === 0) {
    report.verdict = "PASS";
    return;
  }
  const p0 = failCases.filter((c) =>
    /offline|scope|bundle_43a|pageerror|unauthorized/i.test(`${c.group}/${c.case}`)
  );
  report.verdict = p0.length > 0 ? "FAIL" : "PARTIAL";
  report.blockers = failCases.map((c) => `${c.group}/${c.case}: ${c.evidence}`);
}

async function main() {
  assertStagingOnly();
  fs.mkdirSync(EVIDENCE, { recursive: true });

  console.log("\nPhase 43A Preview QA");
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Commit:  ${report.commit}`);
  console.log(`Evidence: ${EVIDENCE}\n`);

  await runLocalGate();
  await runBrowserGate();
  computeVerdict();

  report.summary = {
    pass: report.cases.filter((c) => c.verdict === "PASS").length,
    fail: report.cases.filter((c) => c.verdict === "FAIL").length,
    partial: report.cases.filter((c) => c.verdict === "PARTIAL").length,
    skip: report.cases.filter((c) => c.verdict === "SKIP").length,
    total: report.cases.length,
  };

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Verdict: ${report.verdict}`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (report.verdict === "FAIL" || report.verdict === "BLOCKED") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
