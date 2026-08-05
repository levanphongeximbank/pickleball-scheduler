/**
 * Figure 1 typography loading — repository-approved @fontsource approach.
 *
 * - Self-hosted via npm (no Google Fonts CDN / remote secrets)
 * - font-display: swap (fontsource default) to limit layout shift
 * - Fallback stack: Inter → DM Sans → Segoe UI → system-ui
 * - Vietnamese glyphs covered by Inter + system fallbacks
 *
 * Loaded only when the canonical shell mounts (flag ON).
 */
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

export { FIGURE1_FONT_LOADING } from "./figure1FontMeta.js";
