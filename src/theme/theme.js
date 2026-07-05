import { createTheme } from "@mui/material/styles";

import { LAYOUT, PALETTE, SHAPE, SHELL, TYPOGRAPHY } from "./designTokens.js";

const theme = createTheme({
  palette: {
    primary: PALETTE.primary,
    secondary: PALETTE.secondary,
    success: PALETTE.success,
    warning: PALETTE.warning,
    error: PALETTE.error,
    background: PALETTE.background,
    text: PALETTE.text,
    divider: PALETTE.divider,
  },

  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    h4: { fontWeight: TYPOGRAPHY.fontWeightBold },
    h5: { fontWeight: TYPOGRAPHY.fontWeightBold },
    h6: { fontWeight: TYPOGRAPHY.fontWeightBold },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: "none" },
  },

  shape: {
    borderRadius: SHAPE.borderRadius,
  },

  shadows: [
    "none",
    SHELL.cardShadow,
    "0 2px 6px rgba(15, 23, 42, 0.08)",
    "0 4px 12px rgba(15, 23, 42, 0.08)",
    ...Array(21).fill("0 8px 24px rgba(15, 23, 42, 0.1)"),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: PALETTE.background.default,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.borderRadius,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        contained: {
          "&:hover": { boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.borderRadiusLg,
          border: `1px solid ${PALETTE.divider}`,
          boxShadow: SHELL.cardShadow,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: {
          borderColor: PALETTE.divider,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
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
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#F8FAFC",
            color: PALETTE.text.secondary,
            fontWeight: 700,
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
            backgroundColor: "#FAFBFC",
          },
          "&:hover": {
            backgroundColor: SHELL.accentLight,
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
          fontWeight: 600,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none",
          "&.Mui-selected": {
            backgroundColor: SHELL.accentLight,
            color: PALETTE.primary.dark,
            borderColor: PALETTE.primary.light,
            "&:hover": {
              backgroundColor: "#D1FAE5",
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: SHELL.headerShadow,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            color: PALETTE.primary.main,
          },
        },
      },
    },
  },
});

theme.shell = SHELL;
theme.shellLayout = LAYOUT;

export default theme;
