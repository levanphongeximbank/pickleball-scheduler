import { chromium } from "playwright";

import { PROTOTYPE_SCREEN_CATALOG } from "../src/features/tournament-experience-ui/prototypeScreenCatalog.js";

const BASE = process.env.PHASE2B_BASE || "http://localhost:5174";
const BANNER = "Nguyên mẫu UX Giải đấu";

const FORBIDDEN = [
  "Operator Mode",
  "Presentation Mode",
  "Format Designer",
  "Court Board",
  "Referee Board",
  "Exception Center",
  "Communications Center",
  "Match Center",
  "Full Bracket",
  "Draw next",
  "Needs Attention",
  "Current Event allocation",
  "Event completion",
  "Tournament Complete",
  "Court allocation summary",
  "Publish readiness",
  "Match registry",
  "Incident registry",
  "Presentation content catalog",
  "Active presentation preview",
  "Start presentation",
  "Playout controls",
  "FORMATION CONTEXT",
  "TOURNAMENT SCOPE",
  "EVENT SCOPE",
  "GROUP PROGRESS",
  "DRAW ROOM",
  "POOL A",
  "POOL B",
  "Last saved",
  "Complete Tournament",
  "Register now",
  "Public Tournament Page",
  "MATCH_SCORING_AUTHORITY",
  "COURT_OCCUPANCY_AUTHORITY",
  "PRESENTATION_SESSION_AUTHORITY",
  "SAVE ≠ PUBLISH",
  "SAVE ≠ LOCK",
  "Winner of",
  "Winner QF",
  "Winner SF",
  "Winner R16",
  "Correction / Reopen",
];

const VIEWPORTS = [
  { name: "MOBILE_390", width: 390, height: 844 },
  { name: "TABLET_768", width: 768, height: 1024 },
  { name: "DESKTOP_1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = [];
let failed = false;

for (const route of PROTOTYPE_SCREEN_CATALOG) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(350);
    const metrics = await page.evaluate(({ heading, banner, forbidden }) => {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ");
      const doc = document.documentElement;
      const hits = forbidden.filter((phrase) => text.includes(phrase));
      return {
        hasHeading: text.includes(heading),
        hasBanner: text.includes(banner),
        hits,
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body?.scrollWidth || 0),
      };
    }, { heading: route.heading, banner: BANNER, forbidden: FORBIDDEN });
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    const copyPass = metrics.hits.length === 0;
    const row = {
      id: `SCREEN_${route.id}`,
      viewport: vp.name,
      render: response?.status() === 200 && metrics.hasHeading ? "PASS" : "FAIL",
      banner: metrics.hasBanner ? "PASS" : "FAIL",
      copy: copyPass ? "PASS" : "FAIL",
      overflow: overflow ? "FAIL" : "PASS",
      leftover: metrics.hits,
    };
    if (Object.values(row).includes("FAIL")) failed = true;
    report.push(row);
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
