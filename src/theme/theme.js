import { createTheme } from "@mui/material/styles";

import {
  BREAKPOINTS,
  COLOR,
  ELEVATION,
  INTERACTION,
  LAYOUT,
  PALETTE,
  RADIUS,
  SHAPE,
  SHELL,
  TYPOGRAPHY,
  Z_INDEX,
} from "./designTokens.js";
import { FIGURE1_TOKENS } from "./figure1Tokens.js";

const focusVisibleOutline = {
  outline: `${INTERACTION.focusRingWidth}px solid ${INTERACTION.focusRing}`,
  outlineOffset: INTERACTION.focusRingOffset,
};

/**
 * Authenticated workspace MUI theme — Layer 0 (Wave 2 Batch 2B).
 * Adapts existing createTheme; does not add a second ThemeProvider or token package.
 */
const theme = createTheme({
  palette: {
    primary: PALETTE.primary,
    secondary: PALETTE.secondary,
    success: PALETTE.success,
    warning: PALETTE.warning,
    error: PALETTE.error,
    info: PALETTE.info,
    background: PALETTE.background,
    text: PALETTE.text,
    divider: PALETTE.divider,
    action: PALETTE.action,
  },

  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    h4: { fontWeight: TYPOGRAPHY.fontWeightBold },
    h5: { fontWeight: TYPOGRAPHY.fontWeightBold },
    h6: { fontWeight: TYPOGRAPHY.fontWeightBold },
    subtitle1: { fontWeight: TYPOGRAPHY.fontWeightSemibold },
    subtitle2: { fontWeight: TYPOGRAPHY.fontWeightSemibold },
    button: {
      fontWeight: TYPOGRAPHY.button.weight,
      fontSize: TYPOGRAPHY.button.size,
      textTransform: "none",
    },
    caption: {
      fontSize: TYPOGRAPHY.caption.size,
      fontWeight: TYPOGRAPHY.caption.weight,
      lineHeight: TYPOGRAPHY.caption.lineHeight,
    },
  },

  shape: {
    borderRadius: SHAPE.borderRadius,
  },

  shadows: [
    ELEVATION.flat,
    ELEVATION.raised,
    "0 2px 6px rgba(15, 23, 42, 0.08)",
    "0 4px 12px rgba(15, 23, 42, 0.08)",
    ELEVATION.overlay,
    ...Array(20).fill(ELEVATION.overlay),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: PALETTE.background.default,
          fontFamily: TYPOGRAPHY.fontFamily,
        },
        /**
         * Keyboard focus foundation — does not strip `:focus` for mice/pointer.
         * Component overrides below reinforce the same ring on MUI interactives.
         */
        "a:focus-visible, button:focus-visible, [role='button']:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible":
          focusVisibleOutline,
      },
    },
    MuiButton: {
      defaultProps: {
        /**
         * MUI Button loading API (v6+/v9) — no @mui/lab LoadingButton dependency.
         * Call sites: <Button loading={isPending}>…</Button>
         */
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: SHAPE.borderRadius,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
          "&:focus-visible": focusVisibleOutline,
          "&.Mui-disabled": {
            color: COLOR.disabled.text,
          },
        },
        contained: {
          "&:hover": {
            boxShadow: `0 2px 8px rgba(59, 130, 246, 0.25)`,
          },
        },
        containedPrimary: {
          backgroundColor: PALETTE.primary.main,
          color: PALETTE.primary.contrastText,
          "&:hover": {
            backgroundColor: PALETTE.primary.dark,
          },
        },
        /** DESTRUCTIVE — semantic error/red; never primary blue */
        containedError: {
          backgroundColor: PALETTE.error.main,
          color: "#FFFFFF",
          "&:hover": {
            backgroundColor: PALETTE.error.dark,
            boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
          },
        },
        outlinedError: {
          borderColor: PALETTE.error.main,
          color: PALETTE.error.main,
          "&:hover": {
            borderColor: PALETTE.error.dark,
            backgroundColor: COLOR.error.light,
          },
        },
        /** SUCCESS — completion actions only; not generic primary */
        containedSuccess: {
          backgroundColor: PALETTE.success.main,
          color: PALETTE.success.contrastText,
          "&:hover": {
            backgroundColor: PALETTE.success.dark,
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": focusVisibleOutline,
          "&.Mui-disabled": {
            color: COLOR.disabled.text,
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          "&:focus-visible": focusVisibleOutline,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.borderRadiusLg,
          border: `1px solid ${PALETTE.divider}`,
          boxShadow: ELEVATION.raised,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: {
          borderColor: PALETTE.divider,
        },
        rounded: {
          borderRadius: SHAPE.borderRadius,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: SHAPE.borderRadiusLg,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontSize: TYPOGRAPHY.caption.size,
          lineHeight: TYPOGRAPHY.caption.lineHeight,
          marginLeft: 0,
          marginRight: 0,
          "&.Mui-error": {
            color: PALETTE.error.main,
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        asterisk: {
          color: PALETTE.error.main,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.borderRadius,
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: PALETTE.primary.light,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: PALETTE.primary.main,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: PALETTE.error.main,
          },
          "&.Mui-disabled": {
            backgroundColor: COLOR.disabled.bg,
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: COLOR.surface.muted,
            color: PALETTE.text.secondary,
            fontWeight: TYPOGRAPHY.tableHeader.weight,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            borderBottom: `1px solid ${PALETTE.divider}`,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:nth-of-type(even)": {
            backgroundColor: COLOR.surface.subtle,
          },
          "&:hover": {
            backgroundColor: COLOR.primary.surface,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: PALETTE.divider,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: TYPOGRAPHY.fontWeightSemibold,
          borderRadius: RADIUS.pill,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontWeight: TYPOGRAPHY.fontWeightSemibold,
          textTransform: "none",
          "&:focus-visible": focusVisibleOutline,
          "&.Mui-selected": {
            backgroundColor: COLOR.primary.surface,
            color: PALETTE.primary.dark,
            borderColor: PALETTE.primary.light,
            "&:hover": {
              backgroundColor: COLOR.selected.hover,
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: ELEVATION.header,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            color: PALETTE.primary.main,
          },
          "&:focus-visible": focusVisibleOutline,
        },
      },
    },
  },
});

theme.shell = SHELL;
theme.shellLayout = LAYOUT;
theme.color = COLOR;
theme.elevation = ELEVATION;
theme.interaction = INTERACTION;
theme.radius = RADIUS;
theme.breakpointsAuth = BREAKPOINTS;
theme.zIndexAuth = Z_INDEX;
/** Figure 1 canonical navigation tokens — consumed by canonical-shell when flag ON. */
theme.canonicalNav = FIGURE1_TOKENS;
theme.figure1 = FIGURE1_TOKENS;

export default theme;
