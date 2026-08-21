/**
 * Fixture layout captures for Owner visual acceptance (presentation only).
 * Does not call Staging/Production and does not claim live Owner acceptance.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "artifacts", "referee-ui-lock");
const css = fs.readFileSync(
  path.join(root, "src/features/referee-production-ui/styles/referee-production.css"),
  "utf8"
);

fs.mkdirSync(outDir, { recursive: true });

function pageHtml(kind) {
  const home = `
    <div class="rp-page rp-page-home" data-testid="referee-home">
      <header class="rp-home-header"><h1 class="rp-title">Trọng tài của tôi</h1>
        <p class="rp-sub">Dashboard · Xin chào Phong</p></header>
      <section class="rp-home-date-range"><label class="rp-home-date-field"><span>Từ ngày</span><input type="date" value="2026-08-21"/></label>
        <label class="rp-home-date-field"><span>Đến ngày</span><input type="date" value="2026-08-21"/></label></section>
      <section class="rp-home-select-filters"><label class="rp-home-date-field"><span>Giải đấu</span>
        <select><option>Tất cả giải</option><option selected>Giải nội bộ CLB A</option></select></label>
        <label class="rp-home-date-field"><span>Hình thức</span>
        <select><option>Tất cả hình thức</option><option selected>Giải nội bộ</option></select></label></section>
      <section class="rp-home-summary"><p class="rp-home-summary-title">Hôm nay: 1 trận</p>
        <div class="rp-home-counters"><div class="rp-home-counter"><span class="rp-home-counter-value">1</span><span class="rp-home-counter-label">Sắp diễn ra</span></div>
        <div class="rp-home-counter"><span class="rp-home-counter-value">0</span><span class="rp-home-counter-label">Đang thi đấu</span></div>
        <div class="rp-home-counter"><span class="rp-home-counter-value">0</span><span class="rp-home-counter-label">Hoàn tất</span></div></div></section>
      <article class="rp-card rp-card-compact"><div class="rp-card-meta-row"><span>TT412 Sân 1</span> | <span>10:00</span> | <span>Giải nội bộ CLB A</span> | <span class="rp-chip rp-chip-status">Sắp diễn ra</span></div>
        <div class="rp-card-stage-row"><p class="rp-card-mode">Giải nội bộ</p><p class="rp-card-stage">Vòng bảng</p></div>
        <div class="rp-card-vs rp-card-vs-horizontal"><div class="rp-card-side"><span class="rp-card-entry-label">Đội 9</span><span class="rp-card-member-line">An / Bình</span></div>
          <div class="rp-card-vs-label">VS</div>
          <div class="rp-card-side"><span class="rp-card-entry-label">Đội 10</span><span class="rp-card-member-line">Chi / Dũng</span></div></div>
        <a class="rp-btn rp-btn-primary rp-btn-card-action">VÀO TRẬN</a></article>
    </div>`;

  const lineup = `
    <div class="rp-page rp-page-match">
      <header class="rp-match-header"><div class="rp-match-header-top"><h1 class="rp-match-title">Điều hành trận</h1><span class="rp-live-badge">SẴN SÀNG</span></div></header>
      <div class="rp-console" data-testid="referee-console-layout">
        <aside class="rp-zone rp-zone-context"><div class="rp-match-context"><span>TT412 Sân 1</span><span>Giải nội bộ CLB A</span><span>Vòng bảng</span></div>
          <div class="rp-side-stack"><div class="rp-side-identity"><span class="rp-side-identity-key">Side A</span><strong class="rp-side-entry">Đội 9</strong><ul class="rp-side-athletes"><li>An</li><li>Bình</li></ul></div>
          <div class="rp-side-identity"><span class="rp-side-identity-key">Side B</span><strong class="rp-side-entry">Đội 10</strong><ul class="rp-side-athletes"><li>Chi</li><li>Dũng</li></ul></div></div></aside>
        <main class="rp-zone rp-zone-score"><section class="rp-scoreboard"><div class="rp-scoreboard-trio"><div class="rp-score-side"><div class="rp-score-team-name">Đội 9</div><div class="rp-score-label">An / Bình</div></div>
          <div class="rp-score-center"><span class="rp-score-num">0</span><span class="rp-score-colon">:</span><span class="rp-score-num">0</span></div>
          <div class="rp-score-side"><div class="rp-score-team-name">Đội 10</div><div class="rp-score-label">Chi / Dũng</div></div></div></section>
          <section class="rp-lineup-panel"><h2 class="rp-lineup-title">Sắp xếp đội hình (bắt buộc)</h2>
            <p class="rp-lineup-hint">Chọn vị trí VĐV và người giao bóng đầu tiên.</p>
            <button class="rp-btn rp-btn-primary">Xác nhận đội hình</button></section></main>
        <aside class="rp-zone rp-zone-tools"><section class="rp-op-history"><h2 class="rp-op-history-title">Lịch sử trận</h2><p class="rp-sub">Chưa có sự kiện ghi điểm từ runtime.</p></section></aside>
      </div>
    </div>`;

  const active = `
    <div class="rp-page rp-page-match">
      <header class="rp-match-header"><div class="rp-match-header-top"><h1 class="rp-match-title">Điều hành trận</h1><span class="rp-live-badge is-live">((•)) ĐANG THI ĐẤU</span></div></header>
      <div class="rp-console">
        <aside class="rp-zone rp-zone-context"><div class="rp-match-context"><span>TT412 Sân 1</span><span>Giải nội bộ CLB A</span><span>Vòng bảng</span></div>
          <div class="rp-side-stack"><div class="rp-side-identity"><span class="rp-side-identity-key">Side A</span><strong class="rp-side-entry">Đội 9</strong><ul class="rp-side-athletes"><li>An</li><li>Bình</li></ul></div>
          <div class="rp-side-identity"><span class="rp-side-identity-key">Side B</span><strong class="rp-side-entry">Đội 10</strong><ul class="rp-side-athletes"><li>Chi</li><li>Dũng</li></ul></div></div></aside>
        <main class="rp-zone rp-zone-score"><section class="rp-scoreboard"><div class="rp-scoreboard-trio"><div class="rp-score-side is-serving"><div class="rp-score-team-name">Đội 9</div><div class="rp-score-label">An / Bình</div></div>
          <div class="rp-score-center"><span class="rp-score-num">3</span><span class="rp-score-colon">:</span><span class="rp-score-num">2</span></div>
          <div class="rp-score-side"><div class="rp-score-team-name">Đội 10</div><div class="rp-score-label">Chi / Dũng</div></div></div></section>
          <div class="rp-serve-strip"><span class="rp-serve-cell">Giao bóng <strong>An</strong></span><span class="rp-serve-cell">Đỡ bóng <strong>Dũng</strong></span><span class="rp-serve-cell">Lượt giao <strong>Lượt 2</strong></span></div>
          <section class="rp-court rp-court-doubles" style="height:220px;background:#2f80c1;border-radius:12px;position:relative;margin:8px 0;">
            <div class="rp-marker is-serving" style="position:absolute;left:22%;top:28%;transform:translate(-50%,-50%)"><p class="rp-marker-name">An</p></div>
            <div class="rp-marker" style="position:absolute;left:22%;top:72%;transform:translate(-50%,-50%)"><p class="rp-marker-name">Bình</p></div>
            <div class="rp-marker" style="position:absolute;left:78%;top:28%;transform:translate(-50%,-50%)"><p class="rp-marker-name">Chi</p></div>
            <div class="rp-marker is-receiving" style="position:absolute;left:78%;top:72%;transform:translate(-50%,-50%)"><p class="rp-marker-name">Dũng</p></div>
          </section>
          <div class="rp-score-actions"><button class="rp-btn rp-btn-a">+ Điểm Đội 9</button><button class="rp-btn rp-btn-b">+ Điểm Đội 10</button></div></main>
        <aside class="rp-zone rp-zone-tools"><section class="rp-op-history"><h2 class="rp-op-history-title">Lịch sử trận</h2>
          <ol class="rp-op-history-list"><li><strong>Ghi điểm</strong><span>Đội A · 3–2</span></li><li><strong>Đổi giao</strong><span>Lượt 2</span></li></ol></section>
          <button class="rp-btn rp-btn-warn">Đổi đầu sân</button></aside>
      </div>
    </div>`;

  const body = kind === "home" ? home : kind === "lineup" ? lineup : active;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body style="margin:0;background:#eef2ef;">${body}</body></html>`;
}

const shots = [
  { kind: "home", width: 1440, file: "A-home-desktop-1440.png" },
  { kind: "home", width: 768, file: "A-home-tablet-768.png" },
  { kind: "home", width: 390, file: "A-home-mobile-390.png" },
  { kind: "lineup", width: 1440, file: "B-match-before-lineup-desktop-1440.png" },
  { kind: "lineup", width: 768, file: "B-match-before-lineup-tablet-768.png" },
  { kind: "lineup", width: 390, file: "B-match-before-lineup-mobile-390.png" },
  { kind: "active", width: 1440, file: "C-match-active-desktop-1440.png" },
  { kind: "active", width: 768, file: "C-match-active-tablet-768.png" },
  { kind: "active", width: 390, file: "C-match-active-mobile-390.png" },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: 900 } });
  await page.setContent(pageHtml(shot.kind), { waitUntil: "load" });
  await page.screenshot({
    path: path.join(outDir, shot.file),
    fullPage: true,
  });
  await page.close();
  console.log("wrote", shot.file);
}
await browser.close();
console.log("captures complete:", outDir);
