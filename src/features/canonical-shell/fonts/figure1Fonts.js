/**
 * Figure 1 typography loading — repository-approved @fontsource approach.
 *
 * Wave 2B: Inter CSS is loaded once from `src/main.jsx` (authenticated root).
 * This module no longer re-imports Inter CSS (avoids duplicate @font-face).
 * CanonicalAppShell still dynamic-imports this module to flip `data-figure1-font`.
 *
 * - Self-hosted via npm (no Google Fonts CDN / remote secrets)
 * - Fallback stack: Inter → DM Sans → Segoe UI → system-ui
 * - Vietnamese glyphs covered by Inter + system fallbacks
 */
export { FIGURE1_FONT_LOADING } from "./figure1FontMeta.js";
