/**
 * TT-9 — Mobile QA viewport matrix and layout assertions.
 */
import { DEVICE_PROFILES, PROBE } from "./tt6-preview-browser-harness.mjs";

export { DEVICE_PROFILES, PROBE };

/** @type {Record<string, { id: string, label: string, width: number, height: number, category: string, expectsMobileShell: boolean }>} */
export const VIEWPORTS = Object.freeze({
  iphone_portrait: {
    id: "iphone_portrait",
    label: "iPhone SE portrait",
    width: 390,
    height: 844,
    category: "mobile_portrait",
    expectsMobileShell: true,
  },
  iphone_landscape: {
    id: "iphone_landscape",
    label: "iPhone SE landscape",
    width: 844,
    height: 390,
    category: "mobile_landscape",
    expectsMobileShell: true,
  },
  android_portrait: {
    id: "android_portrait",
    label: "Android portrait",
    width: 412,
    height: 915,
    category: "mobile_portrait",
    expectsMobileShell: true,
  },
  android_landscape: {
    id: "android_landscape",
    label: "Android landscape",
    width: 915,
    height: 412,
    category: "mobile_landscape",
    expectsMobileShell: false,
  },
  ipad_portrait: {
    id: "ipad_portrait",
    label: "iPad portrait",
    width: 820,
    height: 1180,
    category: "tablet_portrait",
    expectsMobileShell: true,
  },
  ipad_landscape: {
    id: "ipad_landscape",
    label: "iPad landscape",
    width: 1180,
    height: 820,
    category: "tablet_landscape",
    expectsMobileShell: false,
  },
});

/** Team Tournament routes under mobile QA scope. */
export const TT9_ROUTE_PROFILES = Object.freeze({
  btc: DEVICE_PROFILES.btcA,
  captain: DEVICE_PROFILES.captainA,
  referee: DEVICE_PROFILES.referee,
});

/**
 * Collect layout / interaction metrics from the loaded page.
 * @param {import('playwright').Page} page
 */
export async function collectMobileLayoutMetrics(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main");
    const scrollWidth = Math.max(html.scrollWidth, body?.scrollWidth || 0, main?.scrollWidth || 0);
    const clientWidth = html.clientWidth;
    const viewportHeight = window.innerHeight;

    let overflowOffender = null;
    if (scrollWidth > clientWidth + 2 && main) {
      for (const el of main.querySelectorAll("*")) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        if (rect.right > clientWidth + 2) {
          overflowOffender = {
            tag: el.tagName,
            className: String(el.className || "").slice(0, 100),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
          break;
        }
      }
    }

    const bottomNavPaper = [...document.querySelectorAll('[class*="MuiPaper-root"]')].find((el) =>
      el.querySelector('[class*="MuiBottomNavigation-root"]'),
    );
    const bottomNav = bottomNavPaper?.querySelector('[class*="MuiBottomNavigation-root"]') || null;
    const bottomNavRect = bottomNavPaper?.getBoundingClientRect();

    let bottomNavSafeAreaOk = true;
    if (bottomNavPaper) {
      const pb = window.getComputedStyle(bottomNavPaper).paddingBottom;
      bottomNavSafeAreaOk =
        pb.includes("env(") || pb.includes("safe-area") || parseFloat(pb) >= 0;
    }

    const interactives = [
      ...document.querySelectorAll(
        'main button:not([disabled]), main a[href], main [role="button"]:not([disabled]), main input, main textarea, main select, main [role="combobox"]',
      ),
    ].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight;
    });

    const smallTargets = [];
    const labeledButtons = [];
    for (const el of interactives.slice(0, 80)) {
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40);
      const isLabeledButton =
        el.tagName === "BUTTON" &&
        text.length > 2 &&
        el.getAttribute("role") !== "tab" &&
        !String(el.className || "").includes("MuiTab-root") &&
        !String(el.className || "").includes("MuiIconButton-root") &&
        !String(el.className || "").includes("MuiAutocomplete-popupIndicator") &&
        !String(el.className || "").includes("MuiAutocomplete-clearIndicator") &&
        !/^(Open|Close|Clear)$/i.test(text);
      if (isLabeledButton) {
        labeledButtons.push({ text, w: rect.width, h: rect.height });
      }
      if (rect.width < 44 || rect.height < 44) {
        smallTargets.push({
          tag: el.tagName,
          role: el.getAttribute("role"),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          text,
        });
      }
    }

    const undersizedPrimary = labeledButtons.filter((b) => b.w < 44 || b.h < 44);

    const scrollBefore = window.scrollY;
    window.scrollTo(0, Math.min(document.body.scrollHeight, viewportHeight * 2));
    const scrollAfter = window.scrollY;
    const scrollWorked = scrollAfter > scrollBefore || document.body.scrollHeight <= viewportHeight + 8;
    window.scrollTo(0, 0);

    // Main flex box extends behind fixed bottom nav by design; padding-bottom clears content.
    let mainClearOfBottomNav = true;
    if (main && bottomNavRect?.height) {
      const mainPbPx = parseFloat(window.getComputedStyle(main).paddingBottom) || 0;
      const navHeight = bottomNavRect.height;
      mainClearOfBottomNav = mainPbPx >= Math.min(navHeight + 8, 72);
    }

    const mainPaddingBottom = main ? window.getComputedStyle(main).paddingBottom : "0";
    const mainPbPx = parseFloat(mainPaddingBottom) || 0;

    return {
      bodyLength: (body?.innerText || "").length,
      hasHorizontalOverflow: scrollWidth > clientWidth + 2,
      scrollWidth,
      clientWidth,
      bottomNavVisible: Boolean(bottomNav && bottomNavRect && bottomNavRect.height > 0),
      bottomNavSafeAreaOk,
      mainPaddingBottomPx: mainPbPx,
      mainClearOfBottomNav,
      canScroll: document.body.scrollHeight > viewportHeight + 16,
      scrollWorked,
      interactiveCount: interactives.length,
      smallTargetCount: smallTargets.length,
      undersizedPrimaryCount: undersizedPrimary.length,
      undersizedPrimarySample: undersizedPrimary.slice(0, 4),
      smallTargetsSample: smallTargets.slice(0, 6),
      overflowOffender,
    };
  });
}

/**
 * Open BTC schedule preview dialog when available; return dialog metrics.
 * @param {import('playwright').Page} page
 */
export async function exerciseBtcDialog(page) {
  const previewBtn = page.getByRole("button", { name: /xem sơ đồ trước/i });
  const hasPreview = await previewBtn.isVisible().catch(() => false);
  if (!hasPreview) {
    const buildBtn = page.getByRole("button", { name: /tạo.*lịch/i }).first();
    const hasBuild = await buildBtn.isVisible().catch(() => false);
    if (!hasBuild) {
      return { opened: false, reason: "no_schedule_buttons" };
    }
    await buildBtn.click();
  } else {
    await previewBtn.click();
  }

  await page.waitForTimeout(800);
  const dialog = page.locator('[role="dialog"]').first();
  const visible = await dialog.isVisible().catch(() => false);
  if (!visible) {
    return { opened: false, reason: "dialog_not_visible" };
  }

  const metrics = await dialog.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      fitsViewport:
        rect.left >= -2 &&
        rect.top >= -2 &&
        rect.right <= vw + 2 &&
        rect.bottom <= vh + 2,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportWidth: vw,
      viewportHeight: vh,
    };
  });

  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);

  return { opened: true, ...metrics };
}

/**
 * Focus first form control on captain portal for keyboard overlap check.
 * @param {import('playwright').Page} page
 */
export async function exerciseKeyboardFocus(page) {
  const control = page
    .locator(
      'main input:not([type="hidden"]), main textarea, main [role="combobox"], main .MuiSelect-select',
    )
    .first();
  const exists = (await control.count()) > 0;
  if (!exists) {
    return { focused: false, reason: "no_form_controls" };
  }

  await control.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      return { focused: false, reason: "no_active_element" };
    }
    const rect = active.getBoundingClientRect();
    const vh = window.innerHeight;
    const bottomNav = [...document.querySelectorAll('[class*="MuiPaper-root"]')].find((el) =>
      el.querySelector('[class*="MuiBottomNavigation-root"]'),
    );
    const navTop = bottomNav?.getBoundingClientRect().top ?? vh;
    return {
      focused: true,
      tag: active.tagName,
      visibleInViewport: rect.top >= 0 && rect.bottom <= Math.min(vh, navTop) + 2,
      rectTop: Math.round(rect.top),
      rectBottom: Math.round(rect.bottom),
      navTop: Math.round(navTop),
    };
  });

  return metrics;
}

/**
 * Rotate viewport in-place (orientation change).
 * Prefer Playwright setViewportSize; fall back to CDP when the page main thread
 * stalls across the MUI md shell remount (seen on Team Referee portal).
 * @param {import('playwright').Page} page
 * @param {{ width: number, height: number }} viewport
 */
export async function rotateViewport(page, viewport) {
  const next = { width: viewport.height, height: viewport.width };
  try {
    await Promise.race([
      page.setViewportSize(next),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("setViewportSize_timeout_12s")), 12_000);
      }),
    ]);
    return { method: "playwright" };
  } catch {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: next.width,
      height: next.height,
      deviceScaleFactor: 1,
      mobile: next.width < 900,
      screenWidth: next.width,
      screenHeight: next.height,
    });
    return { method: "cdp_fallback" };
  }
}
