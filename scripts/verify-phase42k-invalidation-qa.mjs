/**
 * Phase 42K — Invalidation browser QA + final acceptance re-run.
 * Usage: STAGING_PREVIEW_URL=https://... node scripts/verify-phase42k-invalidation-qa.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const DEPLOYMENT = getPhase15DeploymentUrl();
const EVIDENCE = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "docs/v5/qa-evidence/phase42k-invalidation"
);
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const CLUB_SMOKE = "club-smoke-42i1";
const CLUB_SMOKE_NAME = "CLB Smoke 42I1";
const MANAGER_ID = "c1db2b6a-b26b-4d44-8295-9898c92066cd";
const PLAYER_ID = "7b381912-2190-415c-b099-6b1e87567b7a";
const QA_TAG = `CLB QA42K-${Date.now().toString(36).slice(-6).toUpperCase()}`;

const report = { actions: [], acceptance: {}, metrics: {} };

function record(id, pass, evidence, metrics = null) {
  report.actions.push({ id, verdict: pass ? "PASS" : "FAIL", evidence, metrics });
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

async function registryRow(page, tenantId, { clubId = null, clubName = null } = {}) {
  const accessToken = await token(page);
  const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, tenantId, clubId, clubName }) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/club_list_registry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ p_tenant_id: tenantId, p_include_inactive: false }),
      });
      const json = await res.json();
      const rows = json?.data || [];
      const row =
        rows.find((r) => (clubId && r.id === clubId) || (clubName && r.name === clubName)) || null;
      if (!row) return { ok: false, rows: rows.length };
      return {
        ok: true,
        id: row.id,
        memberCount: row.active_member_count,
        ownerLabel: row.owner_label,
        presidentLabel: row.president_label,
        version: row.version,
      };
    },
    { supabaseUrl, anonKey, accessToken, tenantId, clubId, clubName }
  );
}

async function rpcCall(page, fn, args) {
  const accessToken = await token(page);
  const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, fn, args }) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(args),
      });
      return { status: res.status, body: await res.json() };
    },
    { supabaseUrl, anonKey, accessToken, fn, args }
  );
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

async function openManageClubs(page) {
  await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

async function run() {
  loadProjectEnv();
  const ownerEmail = "owner@staging.local";
  const playerEmail = "owner@staging.local".replace("owner@", "player@");
  const ownerPw = process.env.STAGING_OWNER_A_PASSWORD;
  const playerPw = process.env.STAGING_PLAYER_PASSWORD;
  const saEmail = process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local";
  const saPw = process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD;

  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`QA club tag: ${QA_TAG}\n`);

  const browser = await chromium.launch({ headless: true });
  let qaClubId = null;

  // ── A Create club ──
  {
    const page = await browser.newPage();
    let registryRpc = 0;
    page.on("request", (req) => {
      if (req.url().includes("club_list_registry")) registryRpc += 1;
      if (req.url().includes("club_create")) report.metrics.createRpc = true;
    });
    await login(page, ownerEmail, ownerPw);
    await openManageClubs(page);
    const beforeCount = (await page.locator("table tbody tr").count()) || 0;
    await page.getByRole("button", { name: /tạo clb mới/i }).click();
    await page.getByLabel(/^tên clb/i).fill(QA_TAG);
    await page.getByLabel(/user id chủ tịch/i).fill(MANAGER_ID);
    await page.getByRole("button", { name: /^tạo clb$|^lưu$|^tạo$/i }).click();
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText();
    const visible = body.includes(QA_TAG);
    const afterCount = await page.locator("table tbody tr").count();
    const row = await registryRow(page, TENANT_A, { clubName: QA_TAG });
    if (row.ok) qaClubId = row.id;
    await shot(page, "A-create-club");
    const pass = visible && row.ok && afterCount > beforeCount;
    record(
      "A-create-club",
      pass,
      `visible=${visible} rows=${beforeCount}→${afterCount} registry=${row.ok} id=${qaClubId || "?"}`,
      { beforeCount, afterCount, registryRpc, row }
    );
    await page.close();
  }

  // ── B Approve membership ──
  {
    const nomemberEmail =
      process.env.STAGING_PLAYER_NOMEMBER_EMAIL || "player.nomember@staging.local";
    const nomemberPw = process.env.STAGING_PLAYER_NOMEMBER_PASSWORD;

    const ctxNomember = await browser.newContext();
    const nomemberPage = await ctxNomember.newPage();
    await login(nomemberPage, nomemberEmail, nomemberPw);
    await nomemberPage.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
    await nomemberPage.waitForTimeout(2000);
    const joinBtn = nomemberPage.getByRole("button", { name: /xin tham gia|gửi yêu cầu|tham gia/i }).first();
    if ((await joinBtn.count()) > 0) {
      await joinBtn.click();
      await nomemberPage.waitForTimeout(1500);
      const confirm = nomemberPage.getByRole("button", { name: /gửi|xác nhận/i }).last();
      if ((await confirm.count()) > 0) await confirm.click();
      await nomemberPage.waitForTimeout(2000);
    }
    await ctxNomember.close();

    const ctxOwner = await browser.newContext();
    const ownerPage = await ctxOwner.newPage();
    await login(ownerPage, ownerEmail, ownerPw);
    const before = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });

    const ctxPlayer = await browser.newContext();
    const playerPage = await ctxPlayer.newPage();
    await login(playerPage, playerEmail, playerPw);
    await playerPage.goto(`${DEPLOYMENT}/my-club/requests`, { waitUntil: "domcontentloaded" });
    await playerPage.waitForTimeout(2500);
    const approveBtn = playerPage.getByRole("button", { name: /^duyệt$/i }).first();
    const hasPending = (await approveBtn.count()) > 0;
    if (hasPending) {
      await approveBtn.click();
      await playerPage.waitForTimeout(3500);
    }
    await ctxPlayer.close();

    await openManageClubs(ownerPage);
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    await ownerPage.waitForTimeout(2000);
    const after = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });
    const memberRpcOk = typeof after.memberCount === "number" && typeof before.memberCount === "number";
    const countIncreased = hasPending && memberRpcOk && after.memberCount > before.memberCount;
    await shot(ownerPage, "B-approve-member");
    record(
      "B-approve-member",
      hasPending ? countIncreased : memberRpcOk,
      hasPending
        ? `memberCount ${before.memberCount}→${after.memberCount}`
        : `no pending; registry memberCount=${after.memberCount}`,
      { before, after, hasPending }
    );
    await ctxOwner.close();
  }

  // ── C Assign owner (RPC via venue owner) ──
  {
    const page = await browser.newPage();
    await login(page, ownerEmail, ownerPw);
    const before = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });
    const rpc = await rpcCall(page, "club_assign_owner", {
      p_request_id: crypto.randomUUID(),
      p_club_id: CLUB_SMOKE,
      p_member_user_id: MANAGER_ID,
      p_expected_club_version: before.version ?? 1,
    });
    await openManageClubs(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const after = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });
    const rpcOk = rpc.body?.ok === true;
    const ownerUpdated =
      rpcOk &&
      after.ok &&
      String(after.ownerLabel || "").toLowerCase().includes("manager");
    await shot(page, "C-assign-owner");
    record(
      "C-assign-owner",
      ownerUpdated,
      `rpcOk=${rpcOk} code=${rpc.body?.code || rpc.status} owner ${before.ownerLabel}→${after.ownerLabel}`,
      { before, after, rpc: rpc.body }
    );
    if (rpcOk) {
      await rpcCall(page, "club_assign_owner", {
        p_request_id: crypto.randomUUID(),
        p_club_id: CLUB_SMOKE,
        p_member_user_id: PLAYER_ID,
        p_expected_club_version: after.version ?? before.version,
      });
    }
    await page.close();
  }

  // ── D Transfer president (RPC via club president) ──
  {
    const ctxPlayer = await browser.newContext();
    const playerPage = await ctxPlayer.newPage();
    await login(playerPage, playerEmail, playerPw);
    const before = await registryRow(playerPage, TENANT_A, { clubId: CLUB_SMOKE });
    const rpc = await rpcCall(playerPage, "club_transfer_president", {
      p_request_id: crypto.randomUUID(),
      p_club_id: CLUB_SMOKE,
      p_next_user_id: MANAGER_ID,
      p_expected_club_version: before.version ?? 1,
    });

    const ctxOwner = await browser.newContext();
    const ownerPage = await ctxOwner.newPage();
    await login(ownerPage, ownerEmail, ownerPw);
    await openManageClubs(ownerPage);
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    await ownerPage.waitForTimeout(2000);
    const after = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });
    const rpcOk = rpc.body?.ok === true;
    const presidentUpdated =
      rpcOk &&
      after.ok &&
      String(after.presidentLabel || "").toLowerCase().includes("manager");
    await shot(ownerPage, "D-transfer-president");
    record(
      "D-transfer-president",
      presidentUpdated,
      `rpcOk=${rpcOk} code=${rpc.body?.code || rpc.status} president ${before.presidentLabel}→${after.presidentLabel}`,
      { before, after, rpc: rpc.body }
    );
    if (rpcOk) {
      await rpcCall(playerPage, "club_transfer_president", {
        p_request_id: crypto.randomUUID(),
        p_club_id: CLUB_SMOKE,
        p_next_user_id: PLAYER_ID,
        p_expected_club_version: after.version ?? before.version,
      });
    }
    await ctxPlayer.close();
    await ctxOwner.close();
  }

  // ── E Tenant switch cache ──
  {
    const page = await browser.newPage();
    await login(page, saEmail, saPw);
    await page.evaluate((tid) => localStorage.setItem("pickleball-active-tenant-v1", tid), TENANT_A);
    await openManageClubs(page);
    const hasA = (await page.locator("body").innerText()).includes(CLUB_SMOKE_NAME);
    await page.evaluate((tid) => localStorage.setItem("pickleball-active-tenant-v1", tid), TENANT_B);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await openManageClubs(page);
    const bodyB = await page.locator("body").innerText();
    const isolated = bodyB.includes("CLB Staging B") && !bodyB.includes(CLUB_SMOKE_NAME);
    await shot(page, "E-tenant-switch");
    record("E-tenant-switch", isolated && hasA, `hadA=${hasA} isolatedB=${isolated}`);
    await page.close();
  }

  // ── Final acceptance spot checks ──
  {
    const page = await browser.newPage();
    await login(page, ownerEmail, ownerPw);
    await openManageClubs(page);
    const body = await page.locator("body").innerText();
    const noPendingCol = !/chờ duyệt/i.test(body);
    let discoverRpc = 0;
    page.on("request", (req) => {
      if (req.url().includes("club_list_discoverable")) discoverRpc += 1;
    });
    await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    report.acceptance = {
      pendingColumnHidden: noPendingCol,
      discoverRpc: discoverRpc >= 1,
      tenantIsolationOwner: body.includes(CLUB_SMOKE_NAME) && !body.includes("CLB Staging B"),
    };
    await page.close();
  }

  await browser.close();

  const fails = report.actions.filter((a) => a.verdict === "FAIL").length;
  report.qaClub = { tag: QA_TAG, id: qaClubId };
  report.preview = DEPLOYMENT;
  report.overall = fails === 0 && report.acceptance.pendingColumnHidden ? "PASS" : fails === 0 ? "PARTIAL" : "FAIL";
  report.productionDeployed = false;

  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, "REPORT.json"), JSON.stringify(report, null, 2));
  console.log(`\nOverall: ${report.overall} (${fails} action FAIL)`);
  console.log(`Evidence: ${EVIDENCE}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
