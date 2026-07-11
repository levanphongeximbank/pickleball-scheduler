/**
 * Phase 42M Production smoke QA — Professional Club UI.
 *
 * No schema/RPC/RLS change. No production data seeding.
 * Reuses existing Phase 42L production QA accounts (magic-link session inject).
 *
 * Coverage:
 *   - My Club desktop / mobile
 *   - Discover
 *   - Members
 *   - Requests
 *   - Manage Clubs
 *   - Platform Clubs
 *   - role/menu matrix 42L
 *   - no unauthorized CTA
 *   - pageerror = 0
 *   - no RPC loop
 *
 * Usage: node scripts/verify-phase42m-production-smoke.mjs
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeProductionEnv, resolveProductionPublicEnv } from "./resolve-production-env.mjs";
import {
  DEPLOYMENT,
  PRODUCTION_REF,
  TENANT_OWNER_EMAIL,
  PRESIDENT_EMAIL,
  CLUB_ACCC_ID,
  TENANT_PROD,
  loginViaMagicLink,
  createAdminClient,
} from "./phase42k-production-helpers.mjs";
import {
  QA_PLAYER_NOMEMBER,
  QA_SA_MEMBER,
} from "./phase42l-production-qa-accounts.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42m-production");
const REPORT_PATH = path.join(EVIDENCE, "PHASE_42M_PRODUCTION_SMOKE_REPORT.json");
const COMMIT = process.env.PHASE42M_COMMIT || "13955f9";
const DEPLOYMENT_ID = process.env.PHASE42M_DEPLOYMENT_ID || "dpl_GiuiviLhLAvc3tBRn6tBhqndcCKE";
const ROLLBACK_DEPLOYMENT_ID =
  process.env.PHASE42M_ROLLBACK_DEPLOYMENT_ID || "dpl_2UDJ7MTYw9AgJFn4fGLWWE6Z5yas";

const PLATFORM_GUARD_RE = /Chỉ Platform Admin\s*\/\s*Super Admin.*sổ đăng ký toàn nền tảng/i;

const MENU = {
  DISCOVER: "Khám phá CLB",
  MY_CLUB: "CLB của tôi",
  MANAGE: "Quản lý CLB",
  PLATFORM: "Tất cả CLB",
};

const ACCOUNTS = {
  playerNoMember: QA_PLAYER_NOMEMBER,
  president: PRESIDENT_EMAIL,
  tenantOwner: TENANT_OWNER_EMAIL,
  saMember: QA_SA_MEMBER,
};

const report = {
  phase: "42M-production-smoke",
  productionUrl: DEPLOYMENT,
  commit: COMMIT,
  deploymentId: DEPLOYMENT_ID,
  rollbackDeploymentId: ROLLBACK_DEPLOYMENT_ID,
  supabaseRef: PRODUCTION_REF,
  accountMap: ACCOUNTS,
  precheck: [],
  envProbe: {},
  cases: [],
  consoleFindings: [],
  networkFindings: [],
  redirectTrace: [],
  screenshots: [],
  phase43Started: false,
  verdict: "PENDING",
};

function record(caseId, verdict, evidence, extra = {}) {
  report.cases.push({ case: caseId, verdict, evidence, ...extra });
  console.log(`[${verdict}] ${caseId}: ${evidence}`);
}

function attachObservers(page, label) {
  let membershipRpc = 0;
  let registryRpc = 0;
  page.on("pageerror", (err) => {
    report.consoleFindings.push(`${label} pageerror: ${err?.message || err}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("React DevTools")) {
        report.consoleFindings.push(`${label} console: ${t}`);
      }
    }
  });
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("club_get_my_active_membership")) membershipRpc += 1;
    if (u.includes("club_list_registry") && req.method() === "POST") registryRpc += 1;
  });
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) report.redirectTrace.push(`${label}: ${f.url()}`);
  });
  return {
    getMembershipRpc: () => membershipRpc,
    getRegistryRpc: () => registryRpc,
    resetRegistry: () => {
      registryRpc = 0;
    },
  };
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(path.relative(rootDir, file).replace(/\\/g, "/"));
  return file;
}

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
}

async function expandNav(page) {
  const toggles = page.locator('[aria-expanded="false"]');
  for (let i = 0; i < Math.min(await toggles.count(), 12); i += 1) {
    await toggles.nth(i).click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function menuHas(page, label) {
  await expandNav(page);
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if ((await page.getByRole("link", { name: re }).count()) > 0) return true;
  const body = await bodyText(page);
  return body.split("\n").some((line) => re.test(line.trim()));
}

async function gotoRoute(page, route) {
  await page.goto(`${DEPLOYMENT}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  return { url: page.url(), body: await bodyText(page) };
}

async function bootstrapProductionEnv() {
  const envTmp = path.join(rootDir, ".env.production-smoke.tmp");
  spawnSync("npx vercel env pull .env.production-smoke.tmp --environment=production --yes", {
    cwd: rootDir,
    stdio: "pipe",
    shell: true,
  });
  const pulled = {};
  if (fs.existsSync(envTmp)) {
    const content = fs.readFileSync(envTmp, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      pulled[line.slice(0, i).trim()] = value;
    }
    try {
      fs.unlinkSync(envTmp);
    } catch {
      /* ignore */
    }
  }
  const publicEnv = await resolveProductionPublicEnv();
  const childEnv = mergeProductionEnv(pulled);
  childEnv.VITE_SUPABASE_URL = publicEnv.url;
  childEnv.VITE_SUPABASE_ANON_KEY = publicEnv.anonKey;
  Object.assign(process.env, childEnv);
}

async function probeBundleEnv() {
  const res = await fetch(`${DEPLOYMENT}/`);
  const html = await res.text();
  const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  let v2 = false;
  let rbac = false;
  let ref = false;
  for (const src of scripts.slice(0, 14)) {
    const js = await (await fetch(`${DEPLOYMENT}${src}`)).text();
    if (/VITE_CLUB_STORAGE_V2[^a-zA-Z]*true/i.test(js) || /"VITE_CLUB_STORAGE_V2":"true"/i.test(js)) v2 = true;
    if (/VITE_RBAC_ENABLED[^a-zA-Z]*true/i.test(js) || /"VITE_RBAC_ENABLED":"true"/i.test(js)) rbac = true;
    if (js.includes(PRODUCTION_REF)) ref = true;
    if (v2 && rbac && ref) break;
  }
  const runtimeV2 = ["true", "1", "yes"].includes(
    String(process.env.VITE_CLUB_STORAGE_V2 || "").trim().toLowerCase()
  );
  const runtimeRbac = ["true", "1", "yes"].includes(
    String(process.env.VITE_RBAC_ENABLED || "").trim().toLowerCase()
  );
  report.envProbe = {
    affectsPhaseVerdict: false,
    note: "informational only — does not affect overall smoke verdict",
    bundle: {
      VITE_CLUB_STORAGE_V2: v2 ? "PASS" : "UNRESOLVED",
      VITE_RBAC_ENABLED: rbac ? "PASS" : "UNRESOLVED",
      productionSupabaseRef: ref ? "PASS" : "FAIL",
    },
    vercelRuntime: {
      VITE_CLUB_STORAGE_V2: runtimeV2 ? "true" : "false_or_missing",
      VITE_RBAC_ENABLED: runtimeRbac ? "true" : "false_or_missing",
    },
    verdict: ref ? "PASS" : "FAIL",
  };
}

async function runAccountPrecheck(admin) {
  for (const email of Object.values(ACCOUNTS)) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, role, status")
      .eq("email", email)
      .maybeSingle();
    const activeMembership =
      profile?.id != null
        ? (
            await admin
              .from("club_members")
              .select("id", { count: "exact", head: true })
              .eq("user_id", profile.id)
              .eq("status", "active")
          ).count ?? 0
        : 0;
    const { count: govCount } = profile?.id
      ? await admin
          .from("club_governance_assignments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "active")
      : { count: 0 };
    report.precheck.push({
      email,
      role: profile?.role ?? null,
      status: profile?.status ?? null,
      activeMembership,
      governanceRows: govCount ?? 0,
      clubAccc: CLUB_ACCC_ID,
      tenant: TENANT_PROD,
    });
  }
}

async function run() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await bootstrapProductionEnv();
  await probeBundleEnv();

  const admin = createAdminClient();
  await runAccountPrecheck(admin);

  console.log(`\nPhase 42M Production smoke`);
  console.log(`Production: ${DEPLOYMENT}`);
  console.log(`Commit: ${COMMIT}  Deployment: ${DEPLOYMENT_ID}`);
  console.log(`Rollback target: ${ROLLBACK_DEPLOYMENT_ID}\n`);

  const browser = await chromium.launch({ headless: true });

  // Case A — My Club desktop (president / active member)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const mon = attachObservers(page, "A");
    try {
      await loginViaMagicLink(page, ACCOUNTS.president);
      const my = await gotoRoute(page, "/my-club");
      const onMyClub = my.url.includes("/my-club");
      const hasHeader = /Thành viên|Chủ tịch|Chủ sở hữu/i.test(my.body);
      const hasInsights = /Lịch sinh hoạt|Yêu cầu chờ|Hoạt động gần đây/i.test(my.body);
      const noJoinOwn = !/Xin tham gia/i.test(my.body);
      const rpc = mon.getMembershipRpc();
      const noLoop = rpc <= 8;
      await shot(page, "prod-a-my-club-desktop");
      record(
        "A_my_club_desktop",
        onMyClub && hasHeader && hasInsights && noJoinOwn && noLoop ? "PASS" : onMyClub && hasHeader ? "PARTIAL" : "FAIL",
        `onMyClub=${onMyClub} header=${hasHeader} insights=${hasInsights} noJoinOwn=${noJoinOwn} membershipRpc=${rpc}`,
        { account: ACCOUNTS.president, finalUrl: my.url, membershipRpc: rpc }
      );
    } catch (e) {
      record("A_my_club_desktop", "FAIL", String(e.message || e), { account: ACCOUNTS.president });
      await shot(page, "prod-a-error").catch(() => {});
    }
    await ctx.close();
  }

  // Case B — My Club mobile 375px
  {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    attachObservers(page, "B");
    try {
      await loginViaMagicLink(page, ACCOUNTS.president);
      await gotoRoute(page, "/my-club");
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      const noOverflow = scrollW <= clientW + 8;
      const body = await bodyText(page);
      const readable = body.length > 100 && /CLB|Thành viên/i.test(body);
      await shot(page, "prod-b-my-club-mobile");
      record(
        "B_my_club_mobile",
        noOverflow && readable ? "PASS" : readable ? "PARTIAL" : "FAIL",
        `noOverflow=${noOverflow} readable=${readable} scrollW=${scrollW} clientW=${clientW}`,
        { account: ACCOUNTS.president }
      );
    } catch (e) {
      record("B_my_club_mobile", "FAIL", String(e.message || e), { account: ACCOUNTS.president });
    }
    await ctx.close();
  }

  // Case C — Discover (PLAYER no membership)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const mon = attachObservers(page, "C");
    try {
      await loginViaMagicLink(page, ACCOUNTS.playerNoMember);
      const disc = await gotoRoute(page, "/discover-clubs");
      const onDiscover = disc.url.includes("/discover-clubs");
      const hasSearch = (await page.getByLabel(/Tìm|search/i).count()) > 0 || /Tìm/i.test(disc.body);
      const hasCard = (await page.locator('[aria-label^="CLB "]').count()) > 0;
      const emptyOk = /Không tìm thấy|Chưa có CLB/i.test(disc.body);
      const rpc = mon.getMembershipRpc();
      await shot(page, "prod-c-discover-desktop");
      record(
        "C_discover",
        onDiscover && hasSearch && (hasCard || emptyOk) && rpc <= 8 ? "PASS" : onDiscover ? "PARTIAL" : "FAIL",
        `onDiscover=${onDiscover} search=${hasSearch} card=${hasCard} empty=${emptyOk} membershipRpc=${rpc}`,
        { account: ACCOUNTS.playerNoMember, finalUrl: disc.url }
      );

      // Mobile discover
      const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const mPage = await mCtx.newPage();
      attachObservers(mPage, "C-mobile");
      await loginViaMagicLink(mPage, ACCOUNTS.playerNoMember);
      const mDisc = await gotoRoute(mPage, "/discover-clubs");
      await shot(mPage, "prod-c-discover-mobile");
      record(
        "C_discover_mobile",
        mDisc.body.length > 50 ? "PASS" : "FAIL",
        `bodyLen=${mDisc.body.length}`
      );
      await mCtx.close();
    } catch (e) {
      record("C_discover", "FAIL", String(e.message || e), { account: ACCOUNTS.playerNoMember });
    }
    await ctx.close();
  }

  // Case D — Members (president)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "D");
    try {
      await loginViaMagicLink(page, ACCOUNTS.president);
      const mem = await gotoRoute(page, "/my-club?view=members");
      const hasMembers = /Thành viên CLB|Thành viên/i.test(mem.body);
      const hasChips = /Chủ tịch|Thành viên|Đang hoạt động/i.test(mem.body);
      await shot(page, "prod-d-members-desktop");
      record(
        "D_members",
        hasMembers && hasChips ? "PASS" : hasMembers ? "PARTIAL" : "FAIL",
        `members=${hasMembers} chips=${hasChips}`,
        { account: ACCOUNTS.president }
      );

      const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const mPage = await mCtx.newPage();
      attachObservers(mPage, "D-mobile");
      await loginViaMagicLink(mPage, ACCOUNTS.president);
      const mMem = await gotoRoute(mPage, "/my-club?view=members");
      await shot(mPage, "prod-d-members-mobile");
      record("D_members_mobile", /Thành viên/i.test(mMem.body) ? "PASS" : "FAIL", `body=${mMem.body.slice(0, 60)}`);
      await mCtx.close();
    } catch (e) {
      record("D_members", "FAIL", String(e.message || e), { account: ACCOUNTS.president });
    }
    await ctx.close();
  }

  // Case E — Requests (president)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "E");
    try {
      await loginViaMagicLink(page, ACCOUNTS.president);
      const req = await gotoRoute(page, "/my-club/requests");
      const hasPanel = /Yêu cầu gia nhập CLB|Yêu cầu gia nhập/i.test(req.body);
      const emptyOrRows = /Không có yêu cầu đang chờ/i.test(req.body) || (await page.getByRole("button", { name: /^Từ chối$|^Duyệt$/i }).count()) > 0;
      await shot(page, "prod-e-requests");
      record(
        "E_requests",
        hasPanel && emptyOrRows ? "PASS" : hasPanel ? "PARTIAL" : "FAIL",
        `panel=${hasPanel} emptyOrRows=${emptyOrRows}`,
        { account: ACCOUNTS.president }
      );
    } catch (e) {
      record("E_requests", "FAIL", String(e.message || e), { account: ACCOUNTS.president });
    }
    await ctx.close();
  }

  // Case F — Manage Clubs (tenant owner) + platform guard, no registry RPC
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const mon = attachObservers(page, "F");
    try {
      await loginViaMagicLink(page, ACCOUNTS.tenantOwner);
      const manageMenu = await menuHas(page, MENU.MANAGE);
      const platformMenu = await menuHas(page, MENU.PLATFORM);
      const manageRoute = await gotoRoute(page, "/manage/clubs");
      const hasTenant = /Tenant:/i.test(manageRoute.body);
      const hasTable = (await page.locator("table").count()) > 0;
      const emptyOk = /Chưa có CLB|Không có CLB/i.test(manageRoute.body);
      mon.resetRegistry();
      const platRoute = await gotoRoute(page, "/platform/clubs");
      const guardVisible = PLATFORM_GUARD_RE.test(platRoute.body);
      const registryRpc = mon.getRegistryRpc();
      await shot(page, "prod-f-manage-clubs");
      record(
        "F_manage_clubs",
        manageMenu && !platformMenu && manageRoute.url.includes("/manage/clubs") && hasTenant && (hasTable || emptyOk) && guardVisible && registryRpc === 0
          ? "PASS"
          : manageRoute.url.includes("/manage/clubs")
            ? "PARTIAL"
            : "FAIL",
        `manageMenu=${manageMenu} platformMenu=${platformMenu} tenant=${hasTenant} table=${hasTable} guard=${guardVisible} registryRpc=${registryRpc}`,
        { account: ACCOUNTS.tenantOwner, finalUrl: manageRoute.url }
      );
    } catch (e) {
      record("F_manage_clubs", "FAIL", String(e.message || e), { account: ACCOUNTS.tenantOwner });
    }
    await ctx.close();
  }

  // Case G — Platform Clubs (SUPER_ADMIN member)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "G");
    try {
      await loginViaMagicLink(page, ACCOUNTS.saMember);
      const platformMenu = await menuHas(page, MENU.PLATFORM);
      const manageMenu = await menuHas(page, MENU.MANAGE);
      const plat = await gotoRoute(page, "/platform/clubs");
      const onPlatform = plat.url.includes("/platform/clubs");
      const blocked = PLATFORM_GUARD_RE.test(plat.body) || /403|không có quyền/i.test(plat.body);
      const hasRegistry = /Sổ đăng ký CLB|Tất cả CLB|Platform|Tenant/i.test(plat.body);
      await shot(page, "prod-g-platform-clubs");
      record(
        "G_platform_clubs",
        platformMenu && manageMenu && onPlatform && !blocked && hasRegistry ? "PASS" : onPlatform && !blocked ? "PARTIAL" : "FAIL",
        `platformMenu=${platformMenu} manageMenu=${manageMenu} onPlatform=${onPlatform} blocked=${blocked} registry=${hasRegistry}`,
        { account: ACCOUNTS.saMember, finalUrl: plat.url }
      );
    } catch (e) {
      record("G_platform_clubs", "FAIL", String(e.message || e), { account: ACCOUNTS.saMember });
    }
    await ctx.close();
  }

  // Case H — role/menu matrix 42L + no unauthorized CTA (PLAYER no membership)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const mon = attachObservers(page, "H");
    try {
      await loginViaMagicLink(page, ACCOUNTS.playerNoMember);
      await page.waitForTimeout(2000);
      const landingDiscover = page.url().includes("/discover-clubs");
      const discover = await menuHas(page, MENU.DISCOVER);
      const myClub = await menuHas(page, MENU.MY_CLUB);
      const manage = await menuHas(page, MENU.MANAGE);
      const platform = await menuHas(page, MENU.PLATFORM);

      // /my-club must redirect to discover
      const myRoute = await gotoRoute(page, "/my-club");
      const redirected = myRoute.url.includes("/discover-clubs");

      // no unauthorized CTA on discover
      const discBody = myRoute.body;
      const noAdminCta =
        !/Rời CLB/i.test(discBody) &&
        !/Quản trị CLB/i.test(discBody) &&
        (await page.getByRole("button", { name: /^Duyệt$|^Từ chối$/i }).count()) === 0;

      // /manage/clubs must be blocked
      const manageRoute = await gotoRoute(page, "/manage/clubs");
      const manageDenied =
        /403|không có quyền|Forbidden/i.test(manageRoute.body) ||
        manageRoute.url.includes("/403") ||
        manageRoute.url.includes("/discover-clubs") ||
        !manageRoute.url.includes("/manage/clubs");

      const rpc = mon.getMembershipRpc();
      await shot(page, "prod-h-matrix-nomember");
      const matrixOk = landingDiscover && discover && !myClub && !manage && !platform;
      record(
        "H_menu_matrix_42l",
        matrixOk && redirected && manageDenied && noAdminCta && rpc <= 10 ? "PASS" : "FAIL",
        `landing=${landingDiscover} discover=${discover} myClub=${myClub} manage=${manage} platform=${platform} redirect=${redirected} manageDenied=${manageDenied} noAdminCta=${noAdminCta} membershipRpc=${rpc}`,
        { account: ACCOUNTS.playerNoMember }
      );
    } catch (e) {
      record("H_menu_matrix_42l", "FAIL", String(e.message || e), { account: ACCOUNTS.playerNoMember });
    }
    await ctx.close();
  }

  await browser.close();

  // Aggregate verdict
  const failCases = report.cases.filter((c) => c.verdict === "FAIL");
  const partialCases = report.cases.filter((c) => c.verdict === "PARTIAL");
  const passCases = report.cases.filter((c) => c.verdict === "PASS");
  const pageErrors = report.consoleFindings.filter((f) => f.includes("pageerror"));
  report.pageErrors = pageErrors.length;

  report.summary = {
    pass: passCases.length,
    partial: partialCases.length,
    fail: failCases.length,
    total: report.cases.length,
    pageErrors: pageErrors.length,
  };

  report.verdict =
    failCases.length === 0 && pageErrors.length === 0
      ? partialCases.length === 0
        ? "PASS"
        : "PARTIAL"
      : "FAIL";

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Summary: ${JSON.stringify(report.summary)}`);
  console.log(`Overall: ${report.verdict}`);
  process.exit(report.verdict === "FAIL" ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
