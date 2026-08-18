import { createTheme } from "@mui/material/styles";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_LAYOUT,
  TOURNAMENT_RADIUS,
  TOURNAMENT_TYPE,
} from "./tournamentDesignTokens.js";

/** Nested MUI theme for the isolated prototype only. */
export function createTournamentExperienceTheme() {
  return createTheme({
    palette: {
      mode: "light",
      primary: {
        main: TOURNAMENT_COLOR.primary,
        dark: TOURNAMENT_COLOR.primaryDark,
        light: TOURNAMENT_COLOR.primaryLight,
        contrastText: TOURNAMENT_COLOR.primaryContrast,
      },
      success: {
        main: TOURNAMENT_COLOR.success,
        light: TOURNAMENT_COLOR.successSurface,
      },
      warning: {
        main: TOURNAMENT_COLOR.warning,
        light: TOURNAMENT_COLOR.warningSurface,
      },
      error: {
        main: TOURNAMENT_COLOR.danger,
        light: TOURNAMENT_COLOR.dangerSurface,
      },
      info: {
        main: TOURNAMENT_COLOR.primary,
        light: TOURNAMENT_COLOR.primarySurface,
      },
      background: {
        default: TOURNAMENT_COLOR.pageBg,
        paper: TOURNAMENT_COLOR.cardBg,
      },
      text: {
        primary: TOURNAMENT_COLOR.text,
        secondary: TOURNAMENT_COLOR.textMuted,
      },
      divider: TOURNAMENT_COLOR.divider,
    },
    typography: {
      fontFamily: TOURNAMENT_TYPE.fontFamily,
      button: {
        textTransform: "none",
        fontWeight: TOURNAMENT_TYPE.buttonLabel.weight,
        fontSize: TOURNAMENT_TYPE.buttonLabel.size,
      },
      h4: { fontWeight: 800 },
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 600 },
    },
    shape: { borderRadius: TOURNAMENT_RADIUS.control },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: TOURNAMENT_LAYOUT.breakpoints.tablet768,
        lg: TOURNAMENT_LAYOUT.breakpoints.tablet1024,
        xl: TOURNAMENT_LAYOUT.breakpoints.desktop1440,
      },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: TOURNAMENT_RADIUS.control,
            minHeight: 36,
            padding: "6px 12px",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: TOURNAMENT_COLOR.pageBg,
          },
        },
      },
    },
  });
}
