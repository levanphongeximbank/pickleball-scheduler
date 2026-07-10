/**
 * Phase 42KA — Governance audit patch QA + Final Acceptance re-run.
 * Usage: STAGING_PREVIEW_URL=https://... node scripts/verify-phase42ka-governance-qa.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const DEPLOYMENT = getPhase15DeploymentUrl();
const EVIDENCE = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "docs/v5/qa-evidence/phase42ka-governance"
);
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const CLUB_SMOKE = "club-smoke-42i1";
const CLUB_SMOKE_NAME = "CLB Smoke 42I1";
const MANAGER_ID = "c1db2b6a-b26b-4d44-8295-9898c92066cd";
const PLAYER_ID = "7b381912-2190-415c-b099-6b1e87567b7a";
const APPLICANT_EMAIL =
  process.env.STAGING_APPLICANT_EMAIL || "player.nomember@staging.local";
const QA_TAG = `CLB QA42KA-${Date.now().toString(36).slice(-5).toUpperCase()}`;

const report = { phase: "42KA", actions: {}, acceptance: {}, preview: DEPLOYMENT };

function pass(id, ok, evidence, metrics = null) {
  report.actions[id] = { verdict: ok ? "PASS" : "FAIL", evidence, metrics };
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${evidence}`);
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

async function clubGet(page, clubId) {
  const res = await rpcCall(page, "club_get", { p_club_id: clubId });
  return res.body?.ok ? res.body.data : null;
}

async function approveApplicantRow(page, applicantEmail) {
  await page.goto(`${DEPLOYMENT}/my-club/requests`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const slug = applicantEmail.split("@")[0].toLowerCase();
  const row = page.locator("tbody tr").filter({ hasText: new RegExp(slug, "i") }).first();
  if ((await row.count()) === 0) return false;
  const approveBtn = row.getByRole("button", { name: /^duyệt$/i });
  if ((await approveBtn.count()) === 0) return false;
  await approveBtn.click();
  await page.waitForTimeout(3500);
  return true;
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

async function openManage(page) {
  await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

async function run() {
  loadProjectEnv();
  const ownerEmail = "owner@staging.local";
  const ownerPw = process.env.STAGING_OWNER_A_PASSWORD;
  const playerEmail = "player@staging.local";
  const playerPw = process.env.STAGING_PLAYER_PASSWORD;
  const applicantPw =
    process.env.STAGING_PLAYER_NOMEMBER_PASSWORD ||
    process.env.STAGING_CASHIER_PASSWORD ||
    process.env.STAGING_CLUB_PASSWORD ||
    "PickleStaging!358";
  const saEmail = process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local";
  const saPw = process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD;
  const nomemberPw = process.env.STAGING_PLAYER_NOMEMBER_PASSWORD;

  console.log(`Phase 42KA QA — ${DEPLOYMENT}\n`);
  const browser = await chromium.launch({ headless: true });

  // ── C Approve member (fresh applicant — not an active member of smoke club) ──
  {
    const ctxC = await browser.newContext();
    const applicantPage = await ctxC.newPage();
    await login(applicantPage, APPLICANT_EMAIL, applicantPw);
    await applicantPage.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
    await applicantPage.waitForTimeout(2000);
    const joinBtn = applicantPage
      .getByRole("button", { name: /xin tham gia|gửi yêu cầu|tham gia/i })
      .first();
    if ((await joinBtn.count()) > 0) {
      await joinBtn.click();
      await applicantPage.waitForTimeout(1000);
      const confirm = applicantPage.getByRole("button", { name: /gửi|xác nhận/i }).last();
      if ((await confirm.count()) > 0) await confirm.click();
      await applicantPage.waitForTimeout(2000);
    }
    await ctxC.close();

    const ctxOwner = await browser.newContext();
    const ownerPage = await ctxOwner.newPage();
    await login(ownerPage, ownerEmail, ownerPw);
    const before = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });

    const ctxPlayer = await browser.newContext();
    const playerPage = await ctxPlayer.newPage();
    await login(playerPage, playerEmail, playerPw);
    const approved = await approveApplicantRow(playerPage, APPLICANT_EMAIL);
    const rows = await playerPage.locator("tbody tr").count();
    const applicantSlug = APPLICANT_EMAIL.split("@")[0];
    const hasApplicant = (await playerPage.locator("body").innerText())
      .toLowerCase()
      .includes(applicantSlug);
    await shot(playerPage, "C-approve-member");
    await ctxPlayer.close();

    await openManage(ownerPage);
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    await pageWait(ownerPage);
    const after = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });
    const ok =
      approved &&
      before.ok &&
      after.ok &&
      after.memberCount > before.memberCount;
    pass(
      "approve-member",
      ok,
      `memberCount ${before.memberCount}→${after.memberCount} approved=${approved} applicant=${APPLICANT_EMAIL} row=${hasApplicant} pendingRows=${rows}`,
      { before, after }
    );
    report.acceptance.approveMember = ok ? "PASS" : "FAIL";
    await ctxOwner.close();
  }

  // ── A Assign owner ──
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, ownerEmail, ownerPw);
    const before = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });
    const rpc = await rpcCall(page, "club_assign_owner", {
      p_request_id: randomUUID(),
      p_club_id: CLUB_SMOKE,
      p_member_user_id: MANAGER_ID,
      p_expected_club_version: before.version ?? 1,
    });
    await openManage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await pageWait(page);
    const after = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });
    const ok =
      rpc.body?.ok === true &&
      after.ok &&
      String(after.ownerLabel || "").toLowerCase().includes("manager");
    await shot(page, "A-assign-owner");
    pass(
      "assign-owner",
      ok,
      `rpcOk=${rpc.body?.ok} owner ${before.ownerLabel}→${after.ownerLabel}`,
      { before, after, rpc: rpc.body }
    );
    report.acceptance.assignOwner = ok ? "PASS" : "FAIL";
    if (rpc.body?.ok) {
      await rpcCall(page, "club_assign_owner", {
        p_request_id: randomUUID(),
        p_club_id: CLUB_SMOKE,
        p_member_user_id: PLAYER_ID,
        p_expected_club_version: after.version ?? before.version,
      });
    }
    await ctx.close();
  }

  // ── B Transfer president ──
  {
    const ctxOwner = await browser.newContext();
    const ownerPage = await ctxOwner.newPage();
    await login(ownerPage, ownerEmail, ownerPw);
    const clubBefore = await clubGet(ownerPage, CLUB_SMOKE);
    const before = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });

    const ctxPlayer = await browser.newContext();
    const playerPage = await ctxPlayer.newPage();
    await login(playerPage, playerEmail, playerPw);
    const rpc = await rpcCall(playerPage, "club_transfer_president", {
      p_request_id: randomUUID(),
      p_club_id: CLUB_SMOKE,
      p_next_user_id: MANAGER_ID,
      p_expected_club_version: clubBefore?.version ?? before.version ?? 1,
    });

    await openManage(ownerPage);
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    await pageWait(ownerPage);
    const after = await registryRow(ownerPage, TENANT_A, { clubId: CLUB_SMOKE });
    const ok =
      rpc.body?.ok === true &&
      after.ok &&
      String(after.presidentLabel || "").toLowerCase().includes("manager");
    await shot(ownerPage, "B-transfer-president");
    pass(
      "transfer-president",
      ok,
      `rpcOk=${rpc.body?.ok} president ${before.presidentLabel}→${after.presidentLabel}`,
      { before, after, rpc: rpc.body }
    );
    report.acceptance.transferPresident = ok ? "PASS" : "FAIL";
    if (rpc.body?.ok) {
      const clubMid = await clubGet(playerPage, CLUB_SMOKE);
      await rpcCall(playerPage, "club_transfer_president", {
        p_request_id: randomUUID(),
        p_club_id: CLUB_SMOKE,
        p_next_user_id: PLAYER_ID,
        p_expected_club_version: clubMid?.version ?? after.version ?? before.version,
      });
    }
    await ctxPlayer.close();
    await ctxOwner.close();
  }

  // ── Create club ──
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, ownerEmail, ownerPw);
    await openManage(page);
    const before = await page.locator("table tbody tr").count();
    await page.getByRole("button", { name: /tạo clb mới/i }).click();
    await page.getByLabel(/^tên clb/i).fill(QA_TAG);
    await page.getByLabel(/user id chủ tịch/i).fill(MANAGER_ID);
    await page.getByRole("button", { name: /^tạo clb$|^lưu$|^tạo$/i }).click();
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText();
    const row = await registryRow(page, TENANT_A, { clubName: QA_TAG });
    const ok = body.includes(QA_TAG) && row.ok;
    await shot(page, "create-club");
    pass("create-club", ok, `visible=${body.includes(QA_TAG)} registry=${row.ok} id=${row.id || "?"}`);
    report.acceptance.createClub = ok ? "PASS" : "FAIL";
    report.qaClub = { tag: QA_TAG, id: row.id };
    await ctx.close();
  }

  // ── Tenant isolation + platform + pending col + discover ──
  {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await login(pageA, ownerEmail, ownerPw);
    await openManage(pageA);
    const bodyA = await pageA.locator("body").innerText();
    const isoA = bodyA.includes(CLUB_SMOKE_NAME) && !bodyA.includes("CLB Staging B");
    report.acceptance.tenantIsolationA = isoA ? "PASS" : "FAIL";

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await login(pageB, "owner-b@staging.local", process.env.STAGING_OWNER_B_PASSWORD);
    await openManage(pageB);
    const bodyB = await pageB.locator("body").innerText();
    const isoB = bodyB.includes("CLB Staging B") && !bodyB.includes(CLUB_SMOKE_NAME);
    report.acceptance.tenantIsolationB = isoB ? "PASS" : "FAIL";

    const ctxSa = await browser.newContext();
    const pageSa = await ctxSa.newPage();
    await login(pageSa, saEmail, saPw);
    await pageSa.evaluate(() => localStorage.removeItem("pickleball-active-tenant-v1"));
    await openManage(pageSa);
    const pickTenant = /chọn tenant/i.test(await pageSa.locator("body").innerText());
    await pageSa.goto(`${DEPLOYMENT}/platform/clubs`, { waitUntil: "domcontentloaded" });
    await pageWait(pageSa);
    const plat = await pageSa.locator("body").innerText();
    const platformOk =
      plat.includes(CLUB_SMOKE_NAME) && plat.includes("CLB Staging B");
    report.acceptance.platformRegistry = platformOk ? "PASS" : "FAIL";
    report.acceptance.superAdminNoAutoPick = pickTenant ? "PASS" : "FAIL";

    const noPending = !/chờ duyệt/i.test(bodyA);
    report.acceptance.pendingColumnHidden = noPending ? "PASS" : "FAIL";

    let discoverRpc = 0;
    const ctxD = await browser.newContext();
    const pageD = await ctxD.newPage();
    pageD.on("request", (r) => {
      if (r.url().includes("club_list_discoverable")) discoverRpc += 1;
    });
    await login(pageD, "player.nomember@staging.local", nomemberPw);
    await pageD.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
    await pageWait(pageD);
    report.acceptance.discoverRegression = discoverRpc >= 1 ? "PASS" : "FAIL";

    await ctxA.close();
    await ctxB.close();
    await ctxSa.close();
    await ctxD.close();
  }

  await browser.close();

  const actionFails = Object.values(report.actions).filter((a) => a.verdict === "FAIL").length;
  const accFails = Object.values(report.acceptance).filter((v) => v === "FAIL").length;
  report.overall =
    actionFails === 0 && accFails === 0 ? "PASS" : actionFails === 0 && accFails <= 1 ? "PARTIAL" : "FAIL";
  report.goDeploy42K = report.overall === "PASS";
  report.productionDeployed = false;

  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, "REPORT.json"), JSON.stringify(report, null, 2));
  console.log(`\nOverall: ${report.overall}`);
  console.log(`GO DEPLOY 42K: ${report.goDeploy42K ? "YES" : "NO"}`);
}

function pageWait(page) {
  return page.waitForTimeout(2000);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
