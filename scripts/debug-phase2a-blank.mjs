import { chromium } from "playwright";

const urls = [
  "http://localhost:5174/ux-prototype/tournament-experience",
  "http://localhost:5174/ux-prototype/tournament-experience/t/pick-vn-open-2026",
  "http://localhost:5174/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => logs.push({ type: "pageerror", text: String(err), stack: err.stack }));

for (const url of urls) {
  logs.length = 0;
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => ({
    text: (document.body?.innerText || "").trim().slice(0, 400),
    htmlLen: document.body?.innerHTML?.length || 0,
    rootHTML: document.getElementById("root")?.innerHTML?.slice(0, 300) || "",
  }));
  console.log(JSON.stringify({
    url,
    status: response?.status(),
    bodyText: body.text,
    htmlLen: body.htmlLen,
    rootHTML: body.rootHTML,
    errors: logs.filter((l) => l.type === "error" || l.type === "pageerror").slice(0, 8),
  }, null, 2));
}

await browser.close();
