import { PALETTE, SHELL, SHAPE } from "../../theme/designTokens.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";

/** Hub in-page nav — accent lime khớp mockup Slate Enterprise. */
export const TOURNAMENT_HUB = Object.freeze({
  accent: SHELL.accentLime,
  pageBg: SHELL.pageBg,
  gridGap: 2.5,
  cardMinHeight: 88,
});

/** Kích thước tournament UI — khớp Slate Enterprise (Direction C). */
export const TOURNAMENT_LAYOUT = Object.freeze({
  gridSpacing: 2.5,
  sectionGap: 2.5,
  cardRadius: 2,
  cardPadding: 2.5,
  iconSize: 36,
  tableMaxHeight: 480,
});

export const tournamentCardSx = {
  borderRadius: TOURNAMENT_LAYOUT.cardRadius,
  height: "100%",
  border: "1px solid",
  borderColor: SHELL.border,
  bgcolor: SHELL.cardBg,
  boxShadow: SHELL.cardShadow,
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
};

export const tournamentCardHoverSx = {
  "&:hover": {
    borderColor: TOURNAMENT_HUB.accent,
    boxShadow: SHELL.cardShadowHover,
  },
};

export const tournamentHubTabSx = {
  minHeight: 40,
  mb: TOURNAMENT_HUB.gridGap,
  borderBottom: "1px solid",
  borderColor: SHELL.border,
  "& .MuiTabs-indicator": {
    backgroundColor: TOURNAMENT_HUB.accent,
    height: 2,
  },
  "& .MuiTab-root": {
    textTransform: "none",
    fontWeight: 500,
    fontSize: 14,
    color: SHELL.textSecondary,
    minHeight: 40,
    px: 0,
    mr: 3,
    "&.Mui-selected": {
      color: TOURNAMENT_HUB.accent,
      fontWeight: 600,
    },
  },
};

export const tournamentCardContentSx = {
  p: TOURNAMENT_LAYOUT.cardPadding,
  "&:last-child": { pb: TOURNAMENT_LAYOUT.cardPadding },
};

export const tournamentSectionTitleSx = {
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.3,
};

export const tournamentTableHeadSx = {
  fontSize: 12,
  fontWeight: 600,
  py: 1,
  color: "text.secondary",
  borderBottom: "1px solid",
  borderColor: "divider",
};

export const tournamentTableCellSx = {
  py: 1.25,
  fontSize: 14,
};

export const TOURNAMENT_MODE_ACCENTS = Object.freeze({
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: {
    color: PALETTE.primary.dark,
    bg: SHELL.accentLight,
  },
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: {
    color: PALETTE.error.main,
    bg: PALETTE.error.light,
  },
  [TOURNAMENT_MODE.TEAM_TOURNAMENT]: {
    color: "#7C3AED",
    bg: "#F3E8FF",
  },
  [TOURNAMENT_MODE.DAILY_PLAY]: {
    color: PALETTE.warning.main,
    bg: PALETTE.warning.light,
  },
});

export const TOURNAMENT_MODE_LABELS = Object.freeze({
  [TOURNAMENT_MODE.DAILY_PLAY]: "Chơi vui",
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: "Nội bộ",
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: "Chính thức",
  [TOURNAMENT_MODE.TEAM_TOURNAMENT]: "Đồng đội",
});

export const TOURNAMENT_STATUS_LABELS = Object.freeze({
  [TOURNAMENT_STATUS.DRAFT]: "Nháp",
  [TOURNAMENT_STATUS.REGISTRATION]: "Đăng ký",
  [TOURNAMENT_STATUS.READY]: "Sẵn sàng",
  [TOURNAMENT_STATUS.ACTIVE]: "Đang diễn ra",
  [TOURNAMENT_STATUS.COMPLETED]: "Hoàn thành",
  [TOURNAMENT_STATUS.CANCELLED]: "Đã hủy",
});

const STATUS_CHIP_MAP = Object.freeze({
  [TOURNAMENT_STATUS.ACTIVE]: { color: "success", variant: "outlined" },
  [TOURNAMENT_STATUS.READY]: { color: "info", variant: "outlined" },
  [TOURNAMENT_STATUS.REGISTRATION]: { color: "warning", variant: "outlined" },
  [TOURNAMENT_STATUS.DRAFT]: { color: "default", variant: "outlined" },
  [TOURNAMENT_STATUS.COMPLETED]: { color: "default", variant: "outlined" },
  [TOURNAMENT_STATUS.CANCELLED]: { color: "error", variant: "outlined" },
});

export function tournamentStatusChipProps(status) {
  return STATUS_CHIP_MAP[status] || { color: "default", variant: "outlined" };
}

export function tournamentModeAccent(mode) {
  return TOURNAMENT_MODE_ACCENTS[mode] || {
    color: PALETTE.secondary.main,
    bg: PALETTE.background.default,
  };
}

export const matchCardSx = {
  borderRadius: SHAPE.borderRadius / 8,
  border: "1px solid",
  borderColor: "divider",
  boxShadow: SHELL.cardShadow,
  overflow: "hidden",
};

export function matchStatusBorderColor(status) {
  if (status === "live" || status === "in_progress") return PALETTE.primary.main;
  if (status === "ready" || status === "scheduled") return PALETTE.warning.main;
  if (status === "completed" || status === "done") return PALETTE.secondary.light;
  return PALETTE.divider;
}
