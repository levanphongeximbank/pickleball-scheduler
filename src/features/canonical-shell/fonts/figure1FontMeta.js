/**
 * Figure 1 typography loading metadata (node-safe — no CSS side effects).
 *
 * Wave 2B: Inter CSS loads at authenticated root (`src/main.jsx`).
 * `figure1Fonts.js` is a meta-only dynamic import for CanonicalAppShell readiness.
 */
export const FIGURE1_FONT_LOADING = Object.freeze({
  package: "@fontsource/inter",
  weights: [400, 500, 600, 700],
  display: "swap",
  stack: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
  remoteCdn: false,
  loadStrategy: "root-main-jsx-once",
  notes:
    "Inter CSS is loaded once from main.jsx for authenticated workspace. CanonicalAppShell dynamic-imports figure1Fonts.js for readiness metadata only (no second @font-face). DM Sans remains for PublicLayout isolation + fallback.",
});
