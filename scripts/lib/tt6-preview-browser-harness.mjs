/**
 * Shared TT-6 Preview browser harness helpers (TT-6C/TT-6D).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const STAGING_MEMBERSHIP_SCOPE = STAGING_REF;

export const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  clubId: "club-staging-demo",
  matchupId: "phase23d-matchup-1",
};

export const PROBE_BLOB_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(rootDir, "tests/fixtures/team-tournament-blob-probe.json"), "utf8"),
);

export const DEVICE_PROFILES = Object.freeze({
  btcA: {
    id: "btc_a",
    label: "BTC browser A",
    email: process.env.STAGING_BTC_EMAIL || process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local",
    route: (baseUrl) => `${baseUrl}/tournament/team/${PROBE.tournamentId}`,
    playerId: null,
  },
  btcB: {
    id: "btc_b",
    label: "BTC browser B",
    email: process.env.STAGING_BTC_B_EMAIL || process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local",
    route: (baseUrl) => `${baseUrl}/tournament/team/${PROBE.tournamentId}`,
    playerId: null,
  },
  captainA: {
    id: "captain_a",
    label: "Captain A",
    email: process.env.STAGING_CAPTAIN_A_EMAIL || process.env.STAGING_PLAYER_EMAIL || "player@staging.local",
    route: (baseUrl) => `${baseUrl}/team-portal/${PROBE.tournamentId}`,
    playerId: "player-staging-a-1",
  },
  captainB: {
    id: "captain_b",
    label: "Captain B",
    email: process.env.STAGING_CAPTAIN_B_EMAIL || "club@staging.local",
    route: (baseUrl) => `${baseUrl}/team-portal/${PROBE.tournamentId}`,
    playerId: "player-staging-b-1",
  },
  referee: {
    id: "referee_v5",
    label: "Referee V5 desk",
    email: process.env.STAGING_REFEREE_EMAIL || process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local",
    route: (baseUrl) => `${baseUrl}/team-referee/${PROBE.tournamentId}`,
    playerId: null,
  },
});

const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

/** Resolve staging password per email (mirrors staging-auth-resolve.mjs). */
export function passwordForEmail(email) {
  const normalized = String(email || "").toLowerCase();
  const envMap = {
    "owner@staging.local": "STAGING_OWNER_A_PASSWORD",
    "owner-b@staging.local": "STAGING_OWNER_B_PASSWORD",
    "player@staging.local": "STAGING_CAPTAIN_A_PASSWORD",
    "club@staging.local": "STAGING_CLUB_PASSWORD",
    "admin@staging.local": "STAGING_BTC_PASSWORD",
    "manager@staging.local": "STAGING_MANAGER_PASSWORD",
  };
  const envKey = envMap[normalized];
  const fromEnv = envKey ? String(process.env[envKey] || "").trim() : "";
  if (fromEnv) {
    return fromEnv;
  }
  if (normalized === "owner-b@staging.local") {
    const nonCohortPw = String(process.env.STAGING_NON_COHORT_NEW_PASSWORD || "").trim();
    if (nonCohortPw) {
      return nonCohortPw;
    }
  }
  if (normalized === "player@staging.local") {
    const playerPw = String(
      process.env.STAGING_PLAYER_PASSWORD || process.env.STAGING_PLAYER_NEW_PASSWORD || "",
    ).trim();
    if (playerPw) {
      return playerPw;
    }
  }
  return QA_PASSWORD;
}

export function attachSetupRpcCounter(page) {
  const timestamps = [];
  page.on("request", (req) => {
    if (/team_tournament_get_setup/i.test(req.url())) {
      timestamps.push(Date.now());
    }
  });
  return {
    count: () => timestamps.length,
    countSince: (ms) => timestamps.filter((t) => t >= ms).length,
    reset: () => {
      timestamps.length = 0;
    },
  };
}

export async function readSessionEmail(page) {
  return page.evaluate(() => {
    try {
      const session = JSON.parse(localStorage.getItem("pickleball-auth-session-v1") || "{}");
      return session?.user?.email || null;
    } catch {
      return null;
    }
  });
}

export async function seedBrowserProbeContext(page, profile) {
  const email = typeof profile === "string" ? profile : profile?.email;
  const playerId =
    typeof profile === "object" && profile?.playerId
      ? profile.playerId
      : profile === DEVICE_PROFILES.captainA.email
        ? DEVICE_PROFILES.captainA.playerId
        : profile === DEVICE_PROFILES.captainB.email
          ? DEVICE_PROFILES.captainB.playerId
          : null;

  const tournament = PROBE_BLOB_FIXTURE?.data?.tournaments?.[0];
  await page.evaluate(
    ({ clubId, tenantId, tournament, membershipScope, playerId, seedSource }) => {
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
      } else {
        clubs = clubs.map((club) =>
          club?.id === clubId
            ? { ...club, venueId: tenantId, name: club.name || "Staging Demo" }
            : club,
        );
      }
      localStorage.setItem(clubsKey, JSON.stringify(clubs));

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
                source: seedSource,
              },
            }),
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
      membershipScope: STAGING_MEMBERSHIP_SCOPE,
      playerId,
      seedSource: "tt6-preview-browser-harness",
    },
  );
}

export async function loginPreviewPage(page, baseUrl, profile) {
  const email = typeof profile === "string" ? profile : profile.email;
  const password = passwordForEmail(email);
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 120000 });
  if (/vercel\.com/.test(page.url())) {
    throw new Error("protection_blocked: redirected to Vercel SSO during login");
  }
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000 });
}

export async function openDeviceProfile(page, baseUrl, profile) {
  await loginPreviewPage(page, baseUrl, profile);
  await seedBrowserProbeContext(page, profile);
  await page.goto(profile.route(baseUrl), { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  const body = await page.locator("body").innerText({ timeout: 30000 }).catch(() => "");
  return { body, url: page.url() };
}

export function assertPageHealthy(body, { forbid403 = true, minLen = 80 } = {}) {
  if (!body || body.length < minLen) {
    return false;
  }
  if (forbid403 && /403|Không có quyền|Không tìm thấy giải đấu/i.test(body)) {
    return false;
  }
  return true;
}
