/**
 * Figure 1 typography loading metadata (node-safe — no CSS side effects).
 *
 * Runtime CSS is loaded from `figure1Fonts.js` only when CanonicalAppShell mounts.
 */
export const FIGURE1_FONT_LOADING = Object.freeze({
  package: "@fontsource/inter",
  weights: [400, 500, 600, 700],
  display: "swap",
  stack: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
  remoteCdn: false,
  loadStrategy: "dynamic-import-on-canonical-shell-mount",
  notes:
    "Inter CSS is dynamically imported only when CanonicalAppShell mounts (flag ON). Legacy shell keeps DM Sans from main.jsx and is not restyled.",
});
