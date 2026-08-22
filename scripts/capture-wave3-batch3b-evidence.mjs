/**
 * Wave 3 Batch 3B — route visual and responsive evidence.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(
  root,
  "docs/v5/web-app-experience/wave3/batch-3b/screenshots"
);
const harnessHtml = path.join(root, "batch3b-evidence.html");
const harnessEntry = path.join(root, "scripts/.batch3b-evidence-entry.jsx");

const ROUTES = [
  { key: "court-management", path: "/court-management" },
  { key: "bookings", path: "/court-management/bookings" },
  { key: "calendar", path: "/court-management/calendar" },
  { key: "mobile-check-in", path: "/mobile/check-in" },
];

const requestedCheck = process.env.BATCH3B_CAPTURE_ONLY || "";
const CHECKS = ROUTES.flatMap((route) =>
  [1440, 1024, 430, 390].map((width) => ({
    ...route,
    width,
    height: width >= 1024 ? 900 : 932,
    capture:
      route.key === "mobile-check-in"
        ? width === 430 || width === 390
        : width === 1440 || width === 430,
  }))
).filter(
  (check) =>
    !requestedCheck || requestedCheck === `${check.key}:${check.width}`
);

function writeHarness() {
  writeFileSync(
    harnessHtml,
    '<!doctype html><html lang="vi"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Batch 3B Evidence</title></head><body><div id="root"></div><script type="module" src="/scripts/.batch3b-evidence-entry.jsx"></script></body></html>'
  );
  writeFileSync(
    harnessEntry,
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Box } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../src/theme/theme.js";
import { PlatformRuntimeProvider } from "../src/core/platform/app/PlatformRuntimeProvider.jsx";
import { AuthProvider } from "../src/context/AuthContext.jsx";
import { TenantProvider } from "../src/context/TenantContext.jsx";
import { VenueProvider } from "../src/context/VenueContext.jsx";
import { ClusterProvider } from "../src/context/ClusterContext.jsx";
import { ClubProvider } from "../src/context/ClubContext.jsx";
import { AuthPageHeader } from "../src/features/web-app-ui/index.js";
import CourtManagementHome from "../src/pages/courtManagement/CourtManagementHome.jsx";
import BookingList from "../src/pages/courtManagement/BookingList.jsx";
import CourtCalendarShell from "../src/pages/courtManagement/calendar/CourtCalendarShell.jsx";
import CheckInDashboardPage from "../src/pages/mobile/CheckInDashboardPage.jsx";

const clubId = "batch3b-evidence-club";
const courts = [
  { id: "court-evidence-01", name: "Sân 1", number: 1, active: true, status: "active" },
  { id: "court-evidence-02", name: "Sân 2", number: 2, active: true, status: "active" },
];
const context = { clubId, tenantId: null, courts, bookings: [], revision: 0, onRefresh() {} };

function OutletHost() {
  return <Outlet context={context} />;
}

function OverviewEvidence() {
  return (
    <Routes>
      <Route element={<OutletHost />}>
        <Route path="*" element={<CourtManagementHome />} />
      </Route>
    </Routes>
  );
}

function CalendarEvidence() {
  return (
    <>
      <AuthPageHeader
        title="Lịch sân"
        subtitle="Theo dõi lịch theo ngày, tuần hoặc tháng trong đúng phạm vi cụm sân và sân vật lý."
      />
      <CourtCalendarShell
        clubId={clubId}
        courts={courts}
        bookings={[]}
        clusters={[]}
        onRefresh={() => {}}
        adoptAuthPatterns
      />
    </>
  );
}

function CheckInEvidence() {
  return <CheckInDashboardPage />;
}

const key = new URLSearchParams(window.location.search).get("route") || "court-management";
const content =
  key === "bookings" ? (
    <BookingList {...context} />
  ) : key === "calendar" ? (
    <CalendarEvidence />
  ) : key === "mobile-check-in" ? (
    <CheckInEvidence />
  ) : (
    <OverviewEvidence />
  );

createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <PlatformRuntimeProvider>
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <VenueProvider>
              <ClusterProvider>
                <ClubProvider>
                  <Box
                    data-evidence-route={key}
                    sx={{ width: "100%", minWidth: 0, maxWidth: 1440, mx: "auto", p: { xs: 2, md: 3 } }}
                  >
                    {content}
                  </Box>
                </ClubProvider>
              </ClusterProvider>
            </VenueProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </PlatformRuntimeProvider>
  </ThemeProvider>
);
`
  );
}

async function main() {
  process.env.VITE_CANONICAL_APP_SHELL_ENABLED = "true";
  process.env.VITE_RBAC_ENABLED = "false";
  process.env.VITE_SUPABASE_URL = "";
  process.env.VITE_SUPABASE_ANON_KEY = "";

  mkdirSync(outDir, { recursive: true });
  writeHarness();

  const server = await createServer({
    root,
    configFile: path.join(root, "vite.config.js"),
    define: {
      "import.meta.env.VITE_CANONICAL_APP_SHELL_ENABLED": JSON.stringify("true"),
      "import.meta.env.VITE_RBAC_ENABLED": JSON.stringify("false"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
      "import.meta.env.VITE_COURT_CLUSTERS_ENABLED": JSON.stringify("false"),
    },
    server: { port: 49173, strictPort: true },
  });
  await server.listen();
  const base = server.resolvedUrls?.local?.[0];
  if (!base) throw new Error("Vite server URL missing");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    const clubId = "batch3b-evidence-club";
    localStorage.setItem(
      "pickleball-clubs-v1",
      JSON.stringify([
        {
          id: clubId,
          name: "CLB Minh chứng Batch 3B",
          status: "active",
          venueId: "venue-batch3b-evidence",
          isDefault: true,
        },
      ])
    );
    localStorage.setItem("pickleball-active-club-v1", clubId);
    localStorage.setItem(
      "pickleball-venues-v1",
      JSON.stringify([
        {
          id: "venue-batch3b-evidence",
          tenantId: "tenant-batch3b-evidence",
          name: "Nhà thi đấu Minh chứng",
          timezone: "Asia/Ho_Chi_Minh",
          status: "active",
        },
      ])
    );
    localStorage.setItem(
      `pickleball-club-data-v3::${clubId}`,
      JSON.stringify({
        schemaVersion: 3.5,
        clubId,
        players: [],
        courts: [
          {
            id: "court-evidence-01",
            name: "Sân 1",
            number: 1,
            active: true,
          },
          {
            id: "court-evidence-02",
            name: "Sân 2",
            number: 2,
            active: true,
          },
        ],
        bookings: [],
        customers: [],
        seasons: [],
        leagues: [],
        rounds: [],
        sessions: [],
        tournaments: [],
        active: {
          seasonId: null,
          leagueId: null,
          roundSlot: null,
        },
        director: {
          lockedCourts: [],
          lockedPlayers: [],
        },
      })
    );
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  const results = [];
  const failures = [];

  try {
    for (const check of CHECKS) {
      try {
        await page.setViewportSize({
          width: check.width,
          height: check.height,
        });
        const url = new URL("/batch3b-evidence.html", base);
        url.searchParams.set("route", check.key);
        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await page.waitForSelector('[data-testid="auth-page-header"]', {
          timeout: 30_000,
        });
        await page.waitForTimeout(500);

        const metrics = await page.evaluate(() => {
          const rootElement = document.documentElement;
          const body = document.body;
          return {
            pathname: window.location.pathname,
            logicalRoute:
              document.querySelector("[data-evidence-route]")?.getAttribute(
                "data-evidence-route"
              ) || "",
            title: document.querySelector("h1")?.textContent?.trim() || "",
            authHeaders: document.querySelectorAll(
              '[data-testid="auth-page-header"]'
            ).length,
            pageOverflow:
              rootElement.scrollWidth > rootElement.clientWidth + 2 ||
              body.scrollWidth > body.clientWidth + 2,
            scrollWidth: Math.max(rootElement.scrollWidth, body.scrollWidth),
            clientWidth: rootElement.clientWidth,
            overflowingElements: [...document.querySelectorAll("*")]
              .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                  tag: element.tagName,
                  className:
                    typeof element.className === "string"
                      ? element.className.slice(0, 120)
                      : "",
                  text: String(element.textContent || "").trim().slice(0, 80),
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                };
              })
              .filter(
                (item) =>
                  item.right > window.innerWidth + 2 || item.left < -2
              )
              .slice(0, 12),
          };
        });

        if (metrics.logicalRoute !== check.key) {
          throw new Error(
            `Route mismatch: expected ${check.key}, received ${metrics.logicalRoute}`
          );
        }
        if (metrics.authHeaders !== 1 || !metrics.title) {
          throw new Error(`Header contract failed: ${JSON.stringify(metrics)}`);
        }
        if (metrics.pageOverflow) {
          throw new Error(`Page overflow: ${JSON.stringify(metrics)}`);
        }

        let file = null;
        if (check.capture) {
          file = path.join(outDir, `${check.key}-${check.width}.png`);
          await page.screenshot({ path: file, fullPage: false });
        }

        results.push({
          route: check.path,
          width: check.width,
          captured: check.capture,
          file: file
            ? path.relative(root, file).replace(/\\/g, "/")
            : null,
          ...metrics,
        });
      } catch (error) {
        failures.push({
          route: check.path,
          width: check.width,
          error: String(error?.message || error),
        });
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
    for (const temporaryFile of [harnessHtml, harnessEntry]) {
      try {
        unlinkSync(temporaryFile);
      } catch {
        // Best-effort cleanup; git status verifies no harness residue.
      }
    }
  }

  const report = {
    capturedAt: new Date().toISOString(),
    checks: results.length,
    screenshots: results.filter((item) => item.captured).length,
    newHorizontalPageOverflowCount: results.filter(
      (item) => item.pageOverflow
    ).length,
    results,
    failures,
  };

  writeFileSync(
    path.join(outDir, "..", "BATCH_3B_VISUAL_EVIDENCE.json"),
    JSON.stringify(report, null, 2)
  );

  if (failures.length > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
