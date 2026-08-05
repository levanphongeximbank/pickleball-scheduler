import { createTheme } from "@mui/material/styles";

import { FIGURE1_LAYOUT, FIGURE1_TYPOGRAPHY } from "../../../theme/figure1Tokens.js";

/**
 * Nested Figure 1 theme overrides for the canonical shell only.
 * - Card radius 12 (Figure 1) via MuiCard only
 * - Intentionally does NOT override MuiPaper.rounded (would leak into Dialog/Menu/Popover)
 * - Typography stack prefers Inter when font CSS is loaded
 */
export function createFigure1ShellTheme(baseTheme) {
  return createTheme(baseTheme, {
    typography: {
      fontFamily: FIGURE1_TYPOGRAPHY.fontFamily,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: FIGURE1_LAYOUT.cardRadius,
          },
        },
      },
    },
  });
}
