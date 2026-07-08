import { PALETTE, SHELL, SHAPE } from "../../../theme/designTokens.js";

/** Cell tones — operational status for calendar grid */
export const CALENDAR_CELL_TONES = Object.freeze({
  empty: {
    label: "Trống",
    bg: PALETTE.background.default,
    color: PALETTE.text.secondary,
    border: PALETTE.divider,
    hoverBg: SHELL.accentLight,
    hoverBorder: PALETTE.primary.main,
  },
  booked: {
    label: "Đã đặt",
    bg: "#ECFDF5",
    color: "#047857",
    border: "#A7F3D0",
  },
  deposit_paid: {
    label: "Đã cọc",
    bg: "#F0FDFA",
    color: "#0F766E",
    border: "#99F6E4",
  },
  playing: {
    label: "Đang chơi",
    bg: "#D1FAE5",
    color: "#065F46",
    border: PALETTE.primary.main,
  },
  completed: {
    label: "Hoàn thành",
    bg: "#F1F5F9",
    color: PALETTE.text.secondary,
    border: PALETTE.divider,
  },
  cancelled: {
    label: "Đã hủy",
    bg: "#FEF2F2",
    color: "#B91C1C",
    border: "#FECACA",
  },
  locked: {
    label: "Khóa",
    bg: "#F5F5F4",
    color: "#57534E",
    border: "#D6D3D1",
  },
  maintenance: {
    label: "Bảo trì",
    bg: "#FFF7ED",
    color: "#C2410C",
    border: "#FED7AA",
  },
  tournament: {
    label: "Giải đấu",
    bg: "#FFFBEB",
    color: "#B45309",
    border: "#FDE68A",
  },
  social_play: {
    label: "Social Play",
    bg: "#FAF5FF",
    color: "#7E22CE",
    border: "#E9D5FF",
  },
  recurring: {
    label: "Lặp tuần",
    bg: "#EEF2FF",
    color: "#4338CA",
    border: "#C7D2FE",
  },
});

export const CALENDAR_LEGEND_ITEMS = Object.freeze([
  "empty",
  "booked",
  "deposit_paid",
  "playing",
  "maintenance",
  "tournament",
]);

export const CALENDAR_SHELL = Object.freeze({
  cardRadius: SHAPE.borderRadius,
  cardShadow: SHELL.cardShadow,
  cardBorder: `1px solid ${SHELL.border}`,
  primary: PALETTE.primary.main,
  pageBg: SHELL.pageBg,
  nowLine: PALETTE.primary.main,
});

export const PAYMENT_PILL_COLORS = Object.freeze({
  unpaid: { bg: "#FEF3C7", color: "#B45309" },
  deposit_paid: { bg: "#CCFBF1", color: "#0F766E" },
  paid: { bg: "#D1FAE5", color: "#047857" },
  refunded: { bg: "#F1F5F9", color: "#64748B" },
});

export function getCellToneStyle(tone) {
  return CALENDAR_CELL_TONES[tone] || CALENDAR_CELL_TONES.empty;
}
