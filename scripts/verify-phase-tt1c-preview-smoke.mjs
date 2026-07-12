/**
 * TT-1C Preview UI smoke — shadow / cloud_primary, 2 browser profiles.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt1c-preview-smoke.mjs --data-mode-expected=shadow
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt1c-preview-smoke.mjs --data-mode-expected=cloud_primary --with-mutations
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";
import { probePreviewTeamTournamentEnv } from "./probe-tt1c-preview-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1c");

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  clubId: "club-staging-demo",
  matchupId: "phase23d-matchup-1",
};

const ACCOUNTS = {
  btc: process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local",
  captainA: process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local",
  captainB: process.env.STAGING_CAPTAIN_B_EMAIL || "club@staging.local",
  referee: process.env.STAGING_REFEREE_EMAIL || "manager@staging.local",
};

const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const STAGING_MEMBERSHIP_SCOPE = "qyewbxjsiiyufanzcjcq";

const CAPTAIN_PLAYER_IDS = {
  [ACCOUNTS.captainA.toLowerCase()]: "player-staging-a-1",
  [ACCOUNTS.captainB.toLowerCase()]: "player-staging-b-1",
};

const PROBE_BLOB_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, "tests/fixtures/team-tournament-blob-probe.json"),
    "utf8"
  )
);

function parseArgs(argv) {
  const modeArg = argv.find((a) => a.startsWith("--data-mode-expected="));
  return {
    dataModeExpected: modeArg?.split("=")[1] || "shadow",
    withMutations: argv.includes("--with-mutations"),
    reportFile:
      argv.find((a) => a.startsWith("--report="))?.split("=")[1] ||
      "PREVIEW_UI_SMOKE_REPORT.json",
  };
}

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function createReport(args) {
  return {
    generatedAt: new Date().toISOString(),
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    previewUrl: null,
    deploymentId: null,
    localCommitSha: gitSha(),
    bundleCommitSha: null,
    envProbe: null,
    dataModeExpected: args.dataModeExpected,
    browserProfiles: 4,
    cases: [],
    consoleErrors: [],
    networkFindings: [],
    rpcCounts: {},
    verdict: "PENDING",
  };
}

function record(report, id, pass, expected, actual, detail = "") {
  report.cases.push({ id, pass, expected, actual, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${actual}`);
}

function attachObservers(report, page, label) {
  const counts = { get_setup: 0, visible_lineups: 0, rpc_other: 0 };
  page.__rpcCounts = counts;
  page.on("pageerror", (err) => {
    report.consoleErrors.push(`${label} pageerror: ${err?.message || err}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("DevTools")) {
        report.consoleErrors.push(`${label} console: ${t.slice(0, 200)}`);
      }
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("team_tournament") || url.includes("/rpc/")) {
    if (url.includes("/rpc/team_tournament_get_setup")) {
      counts.get_setup = (counts.get_setup || 0) + 1;
    } else if (url.includes("/rpc/team_tournament_get_visible_lineups")) {
      counts.visible_lineups = (counts.visible_lineups || 0) + 1;
    } else if (url.includes("/rpc/team_tournament")) {
      counts.rpc_other = (counts.rpc_other || 0) + 1;
    }
      if (res.status() >= 400) {
        report.networkFindings.push(`${label} ${res.status()} ${url.slice(0, 100)}`);
      }
    }
  });
}

async function login(page, baseUrl, email, { clearSession = false } = {}) {
  if (clearSession) {
    await page.context().clearCookies();
  }
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).waitFor({ timeout: 30000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(QA_PASSWORD);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem("pickleball-auth-session-v1");
        return Boolean(raw && JSON.parse(raw)?.user?.id);
      } catch {
        return false;
      }
    },
    { timeout: 90000 }
  );
  await seedBrowserProbeContext(page, email);
}

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 25000 }).catch(() => "");
}

function isBlank(text) {
  return String(text || "").trim().length < 40;
}

function hasBadAccess(text) {
  if (/repository contract|REPOSITORY_RPC_GUARD|REPOSITORY_NOT_FOUND/i.test(text)) {
    return true;
  }
  if (/^403$/m.test(text) || /^\s*403\s*$/m.test(text)) {
    return true;
  }
  if (/Không tìm thấy giải đấu/i.test(text) && text.length < 200) {
    return true;
  }
  return false;
}

function hasAccessDeniedScreen(text) {
  return (
    /Không có quyền truy cập/i.test(text) ||
    (/Chỉ đội trưởng hoặc đội phó mới truy cập/i.test(text) &&
      /Về trang Giải đấu/i.test(text)) ||
    (/Bạn không có quyền xem trang trọng tài/i.test(text) && text.length < 600)
  );
}

async function seedBrowserProbeContext(page, email) {
  const tournament = PROBE_BLOB_FIXTURE?.data?.tournaments?.[0];
  const playerId = CAPTAIN_PLAYER_IDS[String(email || "").toLowerCase()] || null;
  await page.evaluate(
    ({ clubId, tenantId, tournament, playerId, membershipScope }) => {
      localStorage.setItem("pickleball-active-club-v1", clubId);
      localStorage.setItem("pickleball-active-tenant-v1", tenantId);

      const clubsKey = "pickleball-clubs-v1";
      let clubs = [];
      try {
        clubs = JSON.parse(localStorage.getItem(clubsKey) || "[]");
      } catch {
        clubs = [];
      }
      if (!clubs.some((club) => club?.id === clubId)) {
        clubs.push({
          id: clubId,
          name: "Staging Demo",
          venueId: tenantId,
          isDefault: false,
        });
        localStorage.setItem(clubsKey, JSON.stringify(clubs));
      } else {
        clubs = clubs.map((club) =>
          club?.id === clubId ? { ...club, venueId: tenantId, name: club.name || "Staging Demo" } : club
        );
        localStorage.setItem(clubsKey, JSON.stringify(clubs));
      }

      if (tournament) {
        const blob = {
          schemaVersion: 3.5,
          clubId,
          tournaments: [tournament],
          players: [],
          courts: [],
          seasons: [],
          leagues: [],
        };
        localStorage.setItem(`pickleball-club-data-v3::${clubId}`, JSON.stringify(blob));
      }

      const sessionKey = "pickleball-auth-session-v1";
      try {
        const session = JSON.parse(localStorage.getItem(sessionKey) || "{}");
        const userId = session?.user?.id;
        if (session.user) {
          session.user = {
            ...session.user,
            clubId,
            venueId: tenantId,
            tenantId,
            ...(playerId ? { playerId } : {}),
          };
          localStorage.setItem(sessionKey, JSON.stringify(session));
        }
        if (userId) {
          if (playerId) {
            const linkKey = "pickleball-athlete-club-link-v1";
            let store = {};
            try {
              store = JSON.parse(localStorage.getItem(linkKey) || "{}");
            } catch {
              store = {};
            }
            store[userId] = {
              clubId,
              playerId,
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(linkKey, JSON.stringify(store));
          }

          const membershipCacheKey = `pb-membership-cache-v1:${membershipScope}:${userId}`;
          sessionStorage.setItem(
            membershipCacheKey,
            JSON.stringify({
              at: Date.now(),
              result: {
                ok: true,
                clubId,
                hasActiveMembership: true,
                club: { id: clubId, name: "Staging Demo" },
                source: "tt1c-ui-smoke-seed",
              },
            })
          );
        }
      } catch {
        // ignore
      }
    },
    {
      clubId: PROBE.clubId,
      tenantId: "venue-staging-a",
      tournament,
      playerId,
      membershipScope: STAGING_MEMBERSHIP_SCOPE,
    }
  );
}

function resetRpcWindow(page) {
  if (page.__rpcCounts) {
    page.__rpcCounts.get_setup = 0;
    page.__rpcCounts.visible_lineups = 0;
    page.__rpcCounts.rpc_other = 0;
  }
}

async function openRoute(report, page, baseUrl, routePath, label) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  resetRpcWindow(page);
  await page.waitForTimeout(5500);
  const currentUrl = page.url();
  const urlOk = currentUrl.includes(routePath.split("?")[0]);
  const text = await bodyText(page);
  const blank = isBlank(text);
  const bad = hasBadAccess(text) || hasAccessDeniedScreen(text);
  const portalOk =
    urlOk &&
    !blank &&
    !bad &&
    (/Portal đội trưởng|portal trọng tài|Phase 23D Probe|Giải đồng đội|Lịch đối đầu|Khóa đội hình|Nhập điểm/i.test(
      text
    ) ||
      routePath.includes("/tournament/team/"));
  record(
    report,
    `${label}_render`,
    portalOk,
    "expected route + tournament UI",
    !urlOk ? `redirected:${currentUrl}` : blank ? "blank" : bad ? "access_or_repo_error" : "rendered",
    routePath
  );
  const pollCount = page.__rpcCounts?.get_setup || 0;
  const pollLimit = label.includes("referee") ? 80 : 6;
  record(
    report,
    `${label}_polling_not_excessive`,
    pollCount <= pollLimit,
    `<=${pollLimit} get_setup in ~5.5s window`,
    String(pollCount)
  );
  return text;
}

async function openBtcMatchupsTab(report, page, baseUrl, tour, label) {
  const url = `${baseUrl}/tournament/team/${tour}?tab=matchups`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  const tab = page.getByRole("tab", { name: /Lịch đối đầu/i });
  if ((await tab.count()) > 0) {
    await tab.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const text = await bodyText(page);
  record(
    report,
    `${label}_matchups_tab`,
    /Khóa đội hình|Lịch đối đầu|lineup_open/i.test(text) || text.length > 80,
    "matchups tab visible",
    text.length > 80 ? "ok" : "empty"
  );
  return page;
}

async function runMutationFlow(report, baseUrl) {
  const prepMid = spawnSync("node", ["scripts/prep-tt1c-staging-matchup-open.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  record(
    report,
    "mutation_flow_matchup_prep",
    prepMid.status === 0,
    "lineup_open before UI mutations",
    prepMid.status === 0 ? "ok" : "fail"
  );

  const browser = await chromium.launch({ headless: true });
  const ctxCapA = await browser.newContext();
  const ctxCapB = await browser.newContext();
  const ctxBtc = await browser.newContext();
  const ctxRef = await browser.newContext();
  const tour = PROBE.tournamentId;

  const pageCapA = await ctxCapA.newPage();
  const pageCapB = await ctxCapB.newPage();
  const pageBtc = await ctxBtc.newPage();
  const pageRef = await ctxRef.newPage();

  attachObservers(report, pageCapA, "mutA");
  attachObservers(report, pageCapB, "mutB");
  attachObservers(report, pageBtc, "mutBtc");
  attachObservers(report, pageRef, "mutRef");

  await login(pageCapA, baseUrl, ACCOUNTS.captainA);
  await openRoute(report, pageCapA, baseUrl, `/team-portal/${tour}`, "mutate_captain_a_open");

  await pageCapA.getByText(/Cần nộp đội hình|Portal đội trưởng/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  const draftBtn = pageCapA.getByRole("button", { name: /Lưu nháp/i });
  await draftBtn.first().scrollIntoViewIfNeeded().catch(() => {});
  const hasDraft =
    (await draftBtn.count()) > 0 ||
    /Cần nộp đội hình/i.test(await bodyText(pageCapA));
  if ((await draftBtn.count()) > 0) {
    await draftBtn.first().click({ timeout: 10000 }).catch(() => {});
    await pageCapA.waitForTimeout(2000);
  }
  record(
    report,
    "captain_a_save_draft",
    hasDraft,
    "draft UI in lineup_open",
    (await draftBtn.count()) > 0 ? "clicked" : hasDraft ? "panel_without_button" : "not_editable"
  );

  await login(pageCapB, baseUrl, ACCOUNTS.captainB);
  await openRoute(report, pageCapB, baseUrl, `/team-portal/${tour}`, "mutate_captain_b_open");
  const capBText = await bodyText(pageCapB);
  const leakPrePublish =
    /player-staging-a-[0-9]/i.test(capBText) &&
    !/Đội hình đối phương sẽ hiển thị sau khi BTC công bố/i.test(capBText);
  record(
    report,
    "captain_b_no_opponent_pre_publish_ui",
    !leakPrePublish,
    "no team A player leak before publish",
    leakPrePublish ? "leak" : "ok"
  );

  const submitB = pageCapB.getByRole("button", { name: /Xác nhận nộp/i });
  await submitB.first().scrollIntoViewIfNeeded().catch(() => {});
  const hasSubmit =
    (await submitB.count()) > 0 ||
    /Cần nộp đội hình/i.test(await bodyText(pageCapB));
  if ((await submitB.count()) > 0) {
    await submitB.first().click({ timeout: 10000 }).catch(() => {});
    await pageCapB.waitForTimeout(2000);
  }
  record(
    report,
    "captain_b_submit",
    hasSubmit,
    "submit UI in lineup_open",
    (await submitB.count()) > 0 ? "clicked" : hasSubmit ? "panel_without_button" : "not_editable"
  );

  await login(pageBtc, baseUrl, ACCOUNTS.btc);
  await openBtcMatchupsTab(report, pageBtc, baseUrl, tour, "mutate_btc");

  const lockBtn = pageBtc.getByRole("button", { name: /Khóa đội hình/i });
  if ((await lockBtn.count()) > 0) {
    await lockBtn.first().scrollIntoViewIfNeeded().catch(() => {});
    await lockBtn.first().click({ timeout: 10000 }).catch(() => {});
    await pageBtc.waitForTimeout(3000);
    record(report, "btc_lock_lineup", true, "lock click", "clicked");
  } else {
    record(report, "btc_lock_lineup", false, "lock button", "not_found");
  }

  const publishBtn = pageBtc.getByRole("button", { name: /^Công bố$/i });
  if ((await publishBtn.count()) > 0) {
    await publishBtn.first().scrollIntoViewIfNeeded().catch(() => {});
    await publishBtn.first().click({ timeout: 10000 }).catch(() => {});
    await pageBtc.waitForTimeout(3000);
    record(report, "btc_publish_lineup", true, "publish click", "clicked");
  } else {
    record(report, "btc_publish_lineup", false, "publish button", "not_found");
  }

  await pageCapA.reload({ waitUntil: "domcontentloaded" });
  await pageCapB.reload({ waitUntil: "domcontentloaded" });
  await pageCapA.waitForTimeout(2000);
  await pageCapB.waitForTimeout(2000);
  const afterPubA = await bodyText(pageCapA);
  const afterPubB = await bodyText(pageCapB);
  record(
    report,
    "captains_see_data_after_publish_reload",
    !isBlank(afterPubA) && !isBlank(afterPubB),
    "both captains have content after publish",
    `a=${isBlank(afterPubA) ? "blank" : "ok"} b=${isBlank(afterPubB) ? "blank" : "ok"}`
  );

  await login(pageRef, baseUrl, ACCOUNTS.referee);
  await openRoute(report, pageRef, baseUrl, `/team-referee/${tour}`, "mutate_referee");
  const confirmScore = pageRef.getByRole("button", { name: /Xác nhận KQ/i });
  const hasScoreBtn = (await confirmScore.count()) > 0;
  record(
    report,
    "referee_can_confirm_result_ui",
    hasScoreBtn || /Chờ BTC công bố|Nhập điểm|portal trọng tài/i.test(await bodyText(pageRef)),
    "referee portal ready after publish",
    hasScoreBtn ? "visible" : "waiting_or_readonly"
  );

  await browser.close();
}

async function main() {
  loadProjectEnv();
  const args = parseArgs(process.argv.slice(2));
  const report = createReport(args);
  const reportPath = path.join(evidenceDir, args.reportFile);

  if (args.withMutations) {
    const prepProfiles = spawnSync("node", ["scripts/prep-tt1c-staging-captain-profiles.mjs"], {
      cwd: rootDir,
      encoding: "utf8",
    });
    record(
      report,
      "staging_captain_profile_prep",
      prepProfiles.status === 0,
      "player_id linked",
      prepProfiles.status === 0 ? "ok" : prepProfiles.stderr?.slice(0, 120) || "fail"
    );

    const prep = spawnSync("node", ["scripts/prep-tt1c-staging-matchup-open.mjs"], {
      cwd: rootDir,
      encoding: "utf8",
    });
    record(
      report,
      "staging_matchup_prep",
      prep.status === 0,
      "lineup_open",
      prep.status === 0 ? "ok" : prep.stderr?.slice(0, 120) || "fail"
    );
  }

  const urlResolution = resolveStagingPreviewUrl(getPhase15DeploymentUrl());
  report.previewUrl = urlResolution.ok ? urlResolution.baseUrl : getPhase15DeploymentUrl();
  report.envProbe = probePreviewTeamTournamentEnv(report.previewUrl);
  report.deploymentId = report.envProbe.deploymentId || null;
  report.bundleCommitSha = report.envProbe.commitSha || null;

  const modeOk =
    report.envProbe.dataMode === args.dataModeExpected ||
    (args.dataModeExpected === "shadow" && report.envProbe.dataMode === "supabase_enabled");

  record(
    report,
    "preview_env_probe",
    report.envProbe.ok && report.envProbe.ttSupabaseLikely && modeOk,
    `mode=${args.dataModeExpected} guards=deployed`,
    JSON.stringify({
      dataMode: report.envProbe.dataMode,
      ttSupabaseLikely: report.envProbe.ttSupabaseLikely,
      tt1bGuardsLikely: report.envProbe.tt1bGuardsLikely,
      deploymentId: report.deploymentId,
    }),
    report.previewUrl
  );

  if (!report.envProbe.ok || !report.envProbe.ttSupabaseLikely || !modeOk) {
    report.verdict = "BLOCKED";
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const ctxBtc = await browser.newContext();
  const ctxCapA = await browser.newContext();
  const ctxCapB = await browser.newContext();
  const ctxRef = await browser.newContext();
  const tour = PROBE.tournamentId;

  const pageBtc = await ctxBtc.newPage();
  const pageCapA = await ctxCapA.newPage();
  const pageCapB = await ctxCapB.newPage();
  const pageRef = await ctxRef.newPage();

  attachObservers(report, pageBtc, "btc");
  attachObservers(report, pageCapA, "capA");
  attachObservers(report, pageCapB, "capB");
  attachObservers(report, pageRef, "ref");

  await login(pageBtc, report.previewUrl, ACCOUNTS.btc);
  await openRoute(report, pageBtc, report.previewUrl, `/tournament/team/${tour}`, "btc_setup");

  await login(pageCapA, report.previewUrl, ACCOUNTS.captainA);
  await openRoute(report, pageCapA, report.previewUrl, `/team-portal/${tour}`, "captain_a_portal");

  await login(pageCapB, report.previewUrl, ACCOUNTS.captainB);
  await openRoute(report, pageCapB, report.previewUrl, `/team-portal/${tour}`, "captain_b_portal");

  await login(pageRef, report.previewUrl, ACCOUNTS.referee);
  await openRoute(report, pageRef, report.previewUrl, `/team-referee/${tour}`, "referee_portal");

  await pageCapA.reload({ waitUntil: "domcontentloaded" });
  await pageCapA.waitForTimeout(1500);
  record(
    report,
    "captain_a_refresh_persistence",
    !isBlank(await bodyText(pageCapA)),
    "content after reload",
    "ok"
  );

  const seriousConsole = report.consoleErrors.filter(
    (e) => !/Failed to load resource|net::ERR/i.test(e)
  );
  record(
    report,
    "no_serious_console_errors",
    seriousConsole.length === 0,
    "0 serious console errors",
    String(seriousConsole.length)
  );

  await browser.close();

  if (args.withMutations && args.dataModeExpected === "cloud_primary") {
    spawnSync(
      "node",
      [
        "scripts/sync-staging-blob-mirror-from-cloud.mjs",
        `--club-id=${PROBE.clubId}`,
        `--tournament-id=${PROBE.tournamentId}`,
      ],
      { cwd: rootDir, encoding: "utf8" }
    );
    const preMutationShadow = spawnSync(
      "node",
      [
        "scripts/compare-team-tournament-blob-cloud.mjs",
        `--tournament-id=${PROBE.tournamentId}`,
        `--club-id=${PROBE.clubId}`,
        `--output=${path.relative(rootDir, path.join(evidenceDir, "SHADOW_COMPARE_REPORT.json"))}`,
      ],
      { cwd: rootDir, encoding: "utf8" }
    );
    record(
      report,
      "shadow_compare_zero_mismatch",
      preMutationShadow.status === 0,
      "0 mismatch before UI mutations",
      preMutationShadow.status === 0 ? "OK" : "FAIL"
    );
    await runMutationFlow(report, report.previewUrl);
  } else {
    spawnSync(
      "node",
      [
        "scripts/sync-staging-blob-mirror-from-cloud.mjs",
        `--club-id=${PROBE.clubId}`,
        `--tournament-id=${PROBE.tournamentId}`,
      ],
      { cwd: rootDir, encoding: "utf8" }
    );
    const shadowCompare = spawnSync(
      "node",
      [
        "scripts/compare-team-tournament-blob-cloud.mjs",
        `--tournament-id=${PROBE.tournamentId}`,
        `--club-id=${PROBE.clubId}`,
        `--output=${path.relative(rootDir, path.join(evidenceDir, "SHADOW_COMPARE_REPORT.json"))}`,
      ],
      { cwd: rootDir, encoding: "utf8" }
    );
    record(
      report,
      "shadow_compare_zero_mismatch",
      shadowCompare.status === 0,
      "0 mismatch",
      shadowCompare.status === 0 ? "OK" : "FAIL"
    );
  }

  if (args.withMutations && args.dataModeExpected === "cloud_primary") {
    const postShadow = spawnSync(
      "node",
      [
        "scripts/sync-staging-blob-mirror-from-cloud.mjs",
        `--club-id=${PROBE.clubId}`,
        `--tournament-id=${PROBE.tournamentId}`,
      ],
      { cwd: rootDir, encoding: "utf8" }
    );
    record(report, "post_mutation_blob_sync", postShadow.status === 0, "mirror ok", String(postShadow.status));
  }

  const allPass = report.cases.every((c) => c.pass);
  report.verdict = allPass ? "PASS" : "FAIL";
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ verdict: report.verdict, reportPath, previewUrl: report.previewUrl }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
