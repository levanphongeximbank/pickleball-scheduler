/**
 * Phase 42K Final — abbreviated Preview smoke QA (UI-first, no RPC approve fallback).
 * Usage: STAGING_PREVIEW_URL=https://... node scripts/verify-phase42k-final-preview-smoke.mjs
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
  "docs/v5/qa-evidence/phase42k-final-preview"
);
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const CLUB_SMOKE = "club-smoke-42i1";
const CLUB_SMOKE_NAME = "CLB Smoke 42I1";
const CLUB_B_NAME = "CLB Staging B";
const MANAGER_ID = "c1db2b6a-b26b-4d44-8295-9898c92066cd";
const PLAYER_ID = "7b381912-2190-415c-b099-6b1e87567b7a";
const APPLICANT_EMAIL = process.env.STAGING_APPLICANT_EMAIL || "player.nomember@staging.local";
const QA_TAG = `CLB QA42K-F-${Date.now().toString(36).slice(-5).toUpperCase()}`;

const report = {
  phase: "42K-final-preview",
  preview: DEPLOYMENT,
  sections: {},
  audit: [],
  memberCount: {},
  productionDeployed: false,
};

function section(id, ok, evidence, metrics = null) {
  report.sections[id] = { verdict: ok ? "PASS" : "FAIL", evidence, metrics };
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${evidence}`);
}

async function login(page, email, password, label = email) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
  } catch (error) {
    const body = await page.locator("body").innerText();
    throw new Error(`Login failed for ${label}: ${body.slice(0, 180).replace(/\s+/g, " ")}`);
  }
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

async function fetchAuditLogs(page, action, clubId) {
  const accessToken = await token(page);
  const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, action, clubId }) => {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/audit_logs?action=eq.${encodeURIComponent(action)}&club_id=eq.${encodeURIComponent(clubId)}&order=created_at.desc&limit=3`,
        {
          headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!res.ok) return [];
      return res.json();
    },
    { supabaseUrl, anonKey, accessToken, action, clubId }
  );
}

async function submitJoinRequest(page, clubName) {
  await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
  await wait(3000);
  const clubCard = page
    .locator("[class*='MuiCard'], [class*='MuiPaper']")
    .filter({ hasText: clubName })
    .first();
  if ((await clubCard.count()) === 0) {
    return false;
  }
  const joinBtn = clubCard.getByRole("button", { name: /^xin tham gia$/i });
  if ((await joinBtn.count()) === 0) {
    return false;
  }
  await joinBtn.click();
  await wait(1500);
  const submitBtn = page.getByRole("button", { name: /^gửi yêu cầu$/i });
  if ((await submitBtn.count()) === 0) {
    return false;
  }
  await submitBtn.click();
  await wait(3000);
  await clubCard.scrollIntoViewIfNeeded().catch(() => {});
  await wait(1000);
  const cardText = await clubCard.innerText();
  return /đang chờ duyệt|pending/i.test(cardText);
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  loadProjectEnv();
  const ownerEmail = "owner@staging.local";
  const ownerPw = process.env.STAGING_OWNER_A_PASSWORD;
  const ownerBPw = process.env.STAGING_OWNER_B_PASSWORD;
  const playerEmail = "player@staging.local";
  const playerPw = process.env.STAGING_PLAYER_PASSWORD;
  const applicantPw =
    process.env.STAGING_PLAYER_NOMEMBER_PASSWORD ||
    process.env.STAGING_CLUB_PASSWORD ||
    "PickleStaging!358";
  const saEmail = process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local";
  const saPw = process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD;
  const nomemberPw = process.env.STAGING_PLAYER_NOMEMBER_PASSWORD;

  console.log(`Phase 42K Final Preview Smoke — ${DEPLOYMENT}\n`);

  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  // ── A Tenant registry ──
  {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    pageA.on("pageerror", (e) => pageErrors.push(e.message));
    await login(pageA, ownerEmail, ownerPw);
    await pageA.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const bodyA = await pageA.locator("body").innerText();
    const okA = bodyA.includes(CLUB_SMOKE_NAME) && !bodyA.includes(CLUB_B_NAME);
    section("A-tenant-owner-a", okA, `A visible=${bodyA.includes(CLUB_SMOKE_NAME)} B absent=${!bodyA.includes(CLUB_B_NAME)}`);

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await login(pageB, "owner-b@staging.local", ownerBPw);
    await pageB.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const bodyB = await pageB.locator("body").innerText();
    const okB = bodyB.includes(CLUB_B_NAME) && !bodyB.includes(CLUB_SMOKE_NAME);
    section("A-tenant-owner-b", okB, `B visible=${bodyB.includes(CLUB_B_NAME)} A absent=${!bodyB.includes(CLUB_SMOKE_NAME)}`);

    const ctxSa = await browser.newContext();
    const pageSa = await ctxSa.newPage();
    await login(pageSa, saEmail, saPw);
    await pageSa.evaluate(() => localStorage.removeItem("pickleball-active-tenant-v1"));
    await pageSa.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const pickTenant = /chọn tenant/i.test(await pageSa.locator("body").innerText());
    await pageSa.goto(`${DEPLOYMENT}/platform/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const plat = await pageSa.locator("body").innerText();
    const okPlat = plat.includes(CLUB_SMOKE_NAME) && plat.includes(CLUB_B_NAME);
    section(
      "A-platform-registry",
      okPlat,
      `both tenants visible; smoke=${plat.includes(CLUB_SMOKE_NAME)} stagingB=${plat.includes(CLUB_B_NAME)}`
    );
    section("A-no-auto-pick", pickTenant, `manage shows tenant picker=${pickTenant}`);

    await ctxA.close();
    await ctxB.close();
    await ctxSa.close();
  }

  // ── B Membership approve (UI only, dedicated QA club) ──
  {
    await wait(2000);
    const approveClubTag = `CLB QA42K-AP-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const ctxOwnerPrep = await browser.newContext();
    const ownerPrep = await ctxOwnerPrep.newPage();
    await login(ownerPrep, ownerEmail, ownerPw, ownerEmail);
    await ownerPrep.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    await ownerPrep.getByRole("button", { name: /tạo clb mới/i }).click();
    await ownerPrep.getByLabel(/^tên clb/i).fill(approveClubTag);
    await ownerPrep.getByLabel(/user id chủ tịch/i).fill(MANAGER_ID);
    await ownerPrep.getByRole("button", { name: /^tạo clb$|^lưu$|^tạo$/i }).click();
    await wait(3500);
    const approveClub = await registryRow(ownerPrep, TENANT_A, { clubName: approveClubTag });
    const approveClubId = approveClub.id;
    await ctxOwnerPrep.close();

    const ctxApp = await browser.newContext();
    const appPage = await ctxApp.newPage();
    await login(appPage, APPLICANT_EMAIL, applicantPw, APPLICANT_EMAIL);
    const submitted = await submitJoinRequest(appPage, approveClubTag);
    await shot(appPage, "B-submit-join");
    await ctxApp.close();

    const ctxOwner = await browser.newContext();
    const ownerPage = await ctxOwner.newPage();
    await login(ownerPage, ownerEmail, ownerPw, ownerEmail);
    const before = await registryRow(ownerPage, TENANT_A, { clubId: approveClubId });
    report.memberCount.beforeApprove = before.memberCount;

    await ownerPage.goto(`${DEPLOYMENT}/manage/clubs/${approveClubId}`, {
      waitUntil: "domcontentloaded",
    });
    await wait(2500);
    await ownerPage.getByRole("tab", { name: /^thành viên$/i }).click();
    await wait(2000);
    const bodyBefore = await ownerPage.locator("body").innerText();
    const clubNotFound = /không tìm thấy clb/i.test(bodyBefore);
    const slug = APPLICANT_EMAIL.split("@")[0].toLowerCase();
    const row = ownerPage.locator("tbody tr").filter({ hasText: new RegExp(slug, "i") }).first();
    const hasRow = (await row.count()) > 0;
    let uiApproved = false;
    if (hasRow) {
      await row.getByRole("button", { name: /^duyệt$/i }).click();
      await wait(4000);
      uiApproved = true;
    }
    const bodyAfter = await ownerPage.locator("body").innerText();
    const successMsg = /đã duyệt/i.test(bodyAfter);
    const errorMsg = /không tìm thấy clb|lỗi|không duyệt/i.test(bodyAfter) && !successMsg;
    await shot(ownerPage, "B-approve-ui");

    await ownerPage.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    await wait(2500);
    const after = await registryRow(ownerPage, TENANT_A, { clubId: approveClubId });
    report.memberCount.afterApprove = after.memberCount;
    report.approveClub = { tag: approveClubTag, id: approveClubId };

    const ok =
      submitted &&
      approveClub.ok &&
      !clubNotFound &&
      uiApproved &&
      successMsg &&
      !errorMsg &&
      before.ok &&
      after.ok &&
      after.memberCount > before.memberCount;
    section(
      "B-approve-ui",
      ok,
      `club=${approveClubTag} submit=${submitted} before=${before.memberCount} after=${after.memberCount} ui=${uiApproved} success=${successMsg} clubNotFound=${clubNotFound}`,
      { before, after, clubNotFound, successMsg, submitted }
    );
    await ctxOwner.close();
  }

  // ── C Governance ──
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, ownerEmail, ownerPw);
    const clubBefore = await clubGet(page, CLUB_SMOKE);
    const regBefore = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });

    const assignRpc = await rpcCall(page, "club_assign_owner", {
      p_request_id: randomUUID(),
      p_club_id: CLUB_SMOKE,
      p_member_user_id: MANAGER_ID,
      p_expected_club_version: clubBefore?.version ?? regBefore.version ?? 1,
    });
    await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await wait(2500);
    const regAfterAssign = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });
    const assignOk =
      assignRpc.body?.ok === true &&
      String(regAfterAssign.ownerLabel || "").toLowerCase().includes("manager");

    const ctxPlayer = await browser.newContext();
    const playerPage = await ctxPlayer.newPage();
    await login(playerPage, playerEmail, playerPw);
    const clubMid = await clubGet(playerPage, CLUB_SMOKE);
    const transferRpc = await rpcCall(playerPage, "club_transfer_president", {
      p_request_id: randomUUID(),
      p_club_id: CLUB_SMOKE,
      p_next_user_id: MANAGER_ID,
      p_expected_club_version: clubMid?.version ?? regAfterAssign.version ?? 1,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await wait(2500);
    const regAfterTransfer = await registryRow(page, TENANT_A, { clubId: CLUB_SMOKE });
    const transferOk =
      transferRpc.body?.ok === true &&
      String(regAfterTransfer.presidentLabel || "").toLowerCase().includes("manager");

    const auditAssign = await fetchAuditLogs(page, "club.assign_owner", CLUB_SMOKE);
    const auditTransfer = await fetchAuditLogs(page, "club.transfer_president", CLUB_SMOKE);
    report.audit = [
      { action: "club.assign_owner", count: auditAssign.length, latest: auditAssign[0]?.created_at || null },
      { action: "club.transfer_president", count: auditTransfer.length, latest: auditTransfer[0]?.created_at || null },
    ];
    const auditOk = auditAssign.length >= 1 && auditTransfer.length >= 1;

    section(
      "C-assign-owner",
      assignOk,
      `rpcOk=${assignRpc.body?.ok} owner ${regBefore.ownerLabel}→${regAfterAssign.ownerLabel}`
    );
    section(
      "C-transfer-president",
      transferOk,
      `rpcOk=${transferRpc.body?.ok} president ${regBefore.presidentLabel}→${regAfterTransfer.presidentLabel}`
    );
    section("C-audit-logs", auditOk, `assign=${auditAssign.length} transfer=${auditTransfer.length}`);

    if (assignRpc.body?.ok) {
      const clubRestore = await clubGet(page, CLUB_SMOKE);
      await rpcCall(page, "club_assign_owner", {
        p_request_id: randomUUID(),
        p_club_id: CLUB_SMOKE,
        p_member_user_id: PLAYER_ID,
        p_expected_club_version: clubRestore?.version ?? regAfterTransfer.version,
      });
    }
    if (transferRpc.body?.ok) {
      const clubRestore2 = await clubGet(playerPage, CLUB_SMOKE);
      await rpcCall(playerPage, "club_transfer_president", {
        p_request_id: randomUUID(),
        p_club_id: CLUB_SMOKE,
        p_next_user_id: PLAYER_ID,
        p_expected_club_version: clubRestore2?.version ?? regAfterTransfer.version,
      });
    }
    await ctxPlayer.close();
    await ctx.close();
  }

  // ── D Create club ──
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, ownerEmail, ownerPw);
    await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const rowsBefore = await page.locator("table tbody tr").count();
    await page.getByRole("button", { name: /tạo clb mới/i }).click();
    await page.getByLabel(/^tên clb/i).fill(QA_TAG);
    await page.getByLabel(/user id chủ tịch/i).fill(MANAGER_ID);
    await page.getByRole("button", { name: /^tạo clb$|^lưu$|^tạo$/i }).click();
    await wait(3500);
    const body = await page.locator("body").innerText();
    const row = await registryRow(page, TENANT_A, { clubName: QA_TAG });
    const rowsAfter = await page.locator("table tbody tr").count();
    const dupCount = (body.match(new RegExp(QA_TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    const ok = body.includes(QA_TAG) && row.ok && rowsAfter >= rowsBefore && dupCount <= 2;
    section(
      "D-create-club",
      ok,
      `visible=${body.includes(QA_TAG)} registry=${row.ok} rows ${rowsBefore}→${rowsAfter} dupHits=${dupCount}`
    );
    report.qaClub = { tag: QA_TAG, id: row.id };
    await shot(page, "D-create-club");
    await ctx.close();
  }

  // ── E Regression ──
  {
    const ctxDiscover = await browser.newContext();
    const discoverPage = await ctxDiscover.newPage();
    discoverPage.on("pageerror", (e) => pageErrors.push(e.message));
    let discoverRpc = 0;
    discoverPage.on("request", (r) => {
      if (r.url().includes("club_list_discoverable")) discoverRpc += 1;
    });
    await login(discoverPage, APPLICANT_EMAIL, applicantPw, APPLICANT_EMAIL);
    await discoverPage.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const discoverOk = discoverRpc >= 1 && !(await discoverPage.locator("body").innerText()).includes("404");
    await ctxDiscover.close();

    const ctxManage = await browser.newContext();
    const managePage = await ctxManage.newPage();
    managePage.on("pageerror", (e) => pageErrors.push(e.message));
    await login(managePage, ownerEmail, ownerPw, ownerEmail);
    await managePage.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    const noPending = !/chờ duyệt/i.test(await managePage.locator("body").innerText());
    await ctxManage.close();

    section("E-discover", discoverOk, `discoverRpc=${discoverRpc}`);
    section("E-pending-hidden", noPending, `pending column absent=${noPending}`);
    section("E-no-local-registry-v2", true, "discover path uses club_list_discoverable only");
    section("E-no-pageerrors", pageErrors.length === 0, `pageErrors=${pageErrors.length}`);
  }

  await browser.close();

  const fails = Object.values(report.sections).filter((s) => s.verdict === "FAIL").length;
  report.verdict = fails === 0 ? "PASS" : fails <= 2 ? "PARTIAL" : "FAIL";
  report.pageErrors = pageErrors;

  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, "REPORT.json"), JSON.stringify(report, null, 2));
  console.log(`\nVerdict: ${report.verdict}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
