/**
 * Phase 42K FINAL ACCEPTANCE — Preview browser + RPC evidence.
 * Usage: STAGING_PREVIEW_URL=https://... node scripts/verify-phase42k-final-acceptance.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const DEPLOYMENT = getPhase15DeploymentUrl();
const SCREEN = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "docs/v5/qa-evidence/phase42k-final"
);
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const CLUB_A_NAME = "CLB Smoke 42I1";
const CLUB_B_NAME = "CLB Staging B";

const report = { sections: {}, rpc: [], console: [] };

function verdict(id, pass, evidence) {
  report.sections[id] = { verdict: pass ? "PASS" : "FAIL", evidence };
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${evidence}`);
}

async function login(page, email, password) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });
}

async function token(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k?.includes("auth-token")) continue;
      try {
        const p = JSON.parse(localStorage.getItem(k));
        return p?.access_token || p?.currentSession?.access_token || null;
      } catch {
        /* */
      }
    }
    return null;
  });
}

async function rpcRegistry(page, tenantId, label) {
  const accessToken = await token(page);
  const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const res = await page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, tenantId }) => {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/club_list_registry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ p_tenant_id: tenantId, p_include_inactive: false }),
      });
      return { status: r.status, body: await r.json() };
    },
    { supabaseUrl, anonKey, accessToken, tenantId }
  );
  report.rpc.push(`${label}: status=${res.status} ok=${res.body?.ok} count=${res.body?.data?.length ?? "n/a"} code=${res.body?.code || ""}`);
  return res;
}

function hasClub(body, name) {
  return body.includes(name);
}

async function manageClubsBody(page) {
  await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return page.locator("body").innerText();
}

async function selectTenant(page, tenantId) {
  await page.evaluate((tid) => localStorage.setItem("pickleball-active-tenant-v1", tid), tenantId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

async function clearTenant(page) {
  await page.evaluate(() => localStorage.removeItem("pickleball-active-tenant-v1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
}

async function shot(page, name) {
  fs.mkdirSync(SCREEN, { recursive: true });
  await page.screenshot({ path: path.join(SCREEN, `${name}.png`), fullPage: true });
}

async function run() {
  loadProjectEnv();
  const ownerA = "owner@staging.local";
  const ownerB = "owner-b@staging.local";
  const sa = process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local";
  const player = process.env.STAGING_PLAYER_NOMEMBER_EMAIL || "player.nomember@staging.local";
  const pwA = process.env.STAGING_OWNER_A_PASSWORD;
  const pwB = process.env.STAGING_OWNER_B_PASSWORD;
  const pwSa = process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD;
  const pwPlayer = process.env.STAGING_PLAYER_NOMEMBER_PASSWORD;

  console.log(`Preview: ${DEPLOYMENT}\n`);
  const browser = await chromium.launch({ headless: true });

  // ── 1 Tenant isolation ──
  {
    const page = await browser.newPage();
    await login(page, ownerA, pwA);
    const bodyA = await manageClubsBody(page);
    const rpcA = await rpcRegistry(page, TENANT_A, "ownerA→tenantA");
    const rpcAB = await rpcRegistry(page, TENANT_B, "ownerA→tenantB");
    await shot(page, "1-owner-a-manage");
    const blocked =
      rpcAB.body?.ok === false ||
      rpcAB.body?.code === "FORBIDDEN" ||
      (Array.isArray(rpcAB.body?.data) && rpcAB.body.data.length === 0);
    const pass =
      hasClub(bodyA, CLUB_A_NAME) &&
      !hasClub(bodyA, CLUB_B_NAME) &&
      rpcA.body?.ok === true &&
      blocked;
    verdict("1-tenant-isolation-A", pass, `uiA=${hasClub(bodyA, CLUB_A_NAME)} !B=${!hasClub(bodyA, CLUB_B_NAME)} crossRpcBlocked=${blocked}`);
    await page.close();
  }
  {
    const page = await browser.newPage();
    await login(page, ownerB, pwB);
    const bodyB = await manageClubsBody(page);
    const rpcB = await rpcRegistry(page, TENANT_B, "ownerB→tenantB");
    const rpcBA = await rpcRegistry(page, TENANT_A, "ownerB→tenantA");
    await shot(page, "1-owner-b-manage");
    const blocked =
      rpcBA.body?.ok === false ||
      rpcBA.body?.code === "FORBIDDEN" ||
      (Array.isArray(rpcBA.body?.data) && rpcBA.body.data.length === 0);
    const pass =
      hasClub(bodyB, CLUB_B_NAME) &&
      !hasClub(bodyB, CLUB_A_NAME) &&
      rpcB.body?.ok === true &&
      blocked;
    verdict("1-tenant-isolation-B", pass, `uiB=${hasClub(bodyB, CLUB_B_NAME)} !A=${!hasClub(bodyB, CLUB_A_NAME)} crossRpcBlocked=${blocked}`);
    await page.close();
  }

  // ── 2 Super Admin desktop ──
  {
    const page = await browser.newPage();
    await login(page, sa, pwSa);
    await clearTenant(page);
    const pre = await manageClubsBody(page);
    const noAuto = /chọn tenant/i.test(pre);
    await selectTenant(page, TENANT_A);
    const bodyTA = await manageClubsBody(page);
    const aOnly = hasClub(bodyTA, CLUB_A_NAME) && !hasClub(bodyTA, CLUB_B_NAME);
    await selectTenant(page, TENANT_B);
    const bodyTB = await manageClubsBody(page);
    const bOnly = hasClub(bodyTB, CLUB_B_NAME) && !hasClub(bodyTB, CLUB_A_NAME);
    await page.goto(`${DEPLOYMENT}/platform/clubs`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const plat = await page.locator("body").innerText();
    const cross = hasClub(plat, CLUB_A_NAME) && hasClub(plat, CLUB_B_NAME);
    await shot(page, "2-sa-platform-clubs");
    const pass = noAuto && aOnly && bOnly && cross;
    verdict("2-super-admin-desktop", pass, `noAuto=${noAuto} aOnly=${aOnly} bOnly=${bOnly} platformCross=${cross}`);
    await page.close();
  }

  // ── 3 Invalidation (tenant switch + UI column probe) ──
  {
    const page = await browser.newPage();
    await login(page, sa, pwSa);
    await selectTenant(page, TENANT_A);
    await manageClubsBody(page);
    await selectTenant(page, TENANT_B);
    const afterSwitch = await manageClubsBody(page);
    const cacheOk = hasClub(afterSwitch, CLUB_B_NAME) && !hasClub(afterSwitch, CLUB_A_NAME);
    // pending column / member count visible on registry table
    const hasMemberCol = /thành viên/i.test(afterSwitch);
    const hasPendingCol = /chờ duyệt/i.test(afterSwitch);
    verdict(
      "3-invalidation-tenant-switch",
      cacheOk,
      `cacheIsolation=${cacheOk} memberCol=${hasMemberCol} pendingCol=${hasPendingCol}`
    );
    verdict(
      "3-invalidation-create-approve-governance",
      false,
      "NOT_BROWSER_VERIFIED: create/approve/owner/president refresh requires manual staging actions (code paths: bumpList/registry.invalidate + bumpRevision→invalidateAllClubRegistryCache)"
    );
    await page.close();
  }

  // ── 4 pending_request_count ──
  {
    const page = await browser.newPage();
    await login(page, ownerA, pwA);
    const body = await manageClubsBody(page);
    const showsDash = /chờ duyệt[\s\S]*—/i.test(body) || body.includes("CHỜ DUYỆT") && body.includes("—");
    const pendingColHidden = !/chờ duyệt/i.test(body);
    const pass = pendingColHidden || !showsDash;
    await shot(page, "4-pending-request-count");
    verdict(
      "4-pending-request-count",
      pass,
      `columnVisible=${/chờ duyệt/i.test(body)} showsMisleadingDash=${showsDash} (RPC field absent in phase42_club_canonical)`
    );
    await page.close();
  }

  // ── 5 Regression discover ──
  {
    const page = await browser.newPage();
    let discoverRpc = 0;
    page.on("request", (req) => {
      if (req.url().includes("club_list_discoverable")) discoverRpc += 1;
    });
    await login(page, player, pwPlayer);
    await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    const pass = /khám phá clb/i.test(body) && discoverRpc >= 1;
    await shot(page, "5-discover-regression");
    verdict("5-discover-regression", pass, `discoverRpc=${discoverRpc}`);
    await page.close();
  }

  await browser.close();

  const fails = Object.values(report.sections).filter((s) => s.verdict === "FAIL").length;
  report.overall = fails === 0 ? "PASS" : "FAIL";
  report.preview = DEPLOYMENT;
  report.commit = "c2f1694";
  fs.mkdirSync(SCREEN, { recursive: true });
  fs.writeFileSync(path.join(SCREEN, "REPORT.json"), JSON.stringify(report, null, 2));
  console.log(`\nOverall: ${report.overall} (${fails} FAIL)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
