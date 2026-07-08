import { alpha } from "@mui/material/styles";
import { PALETTE, SHELL } from "../../theme/designTokens.js";

/** Mockup-aligned palette: dark navy + lime CTA */
export const PUBLIC_COLORS = {
  bg: "#0B0F19",
  bgDeep: "#080C14",
  bgAlt: "#0F1419",
  bgElevated: "#151B24",
  bgLight: "#F8FAFC",
  surface: "#1A2030",
  surfaceLight: "#FFFFFF",
  glass: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.1)",
  primary: "#10B981",
  primaryLight: PALETTE.primary.light,
  lime: "#C5E831",
  limeDark: "#A8C929",
  accent: "#C5E831",
  accentHover: "#B5D82E",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.65)",
  textDark: "#0F172A",
  textDarkMuted: "#64748B",
  border: "rgba(255,255,255,0.08)",
  borderLight: "#E2E8F0",
  cardShadow: "0 12px 40px rgba(0,0,0,0.4)",
  glowLime: `0 0 40px ${alpha("#C5E831", 0.35)}`,
  heroOverlay:
    "linear-gradient(90deg, rgba(8,12,20,0.92) 0%, rgba(8,12,20,0.75) 45%, rgba(8,12,20,0.35) 100%)",
  heroBg: `
    linear-gradient(160deg, #0a1628 0%, #0d1f1a 40%, #0a1410 70%, #080c14 100%),
    radial-gradient(ellipse 70% 50% at 75% 30%, rgba(197,232,49,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 20% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)
  `,
  ctaBannerGradient: "linear-gradient(135deg, #C5E831 0%, #A8C929 50%, #8FB824 100%)",
};

export const publicSectionSx = {
  py: { xs: 5, md: 8 },
  px: { xs: 2, sm: 3, md: 4 },
};

export const publicContainerSx = {
  maxWidth: 1280,
  mx: "auto",
  width: "100%",
};

export const sectionDarkSx = {
  ...publicSectionSx,
  bgcolor: PUBLIC_COLORS.bg,
  color: PUBLIC_COLORS.text,
};

export const sectionLightSx = {
  ...publicSectionSx,
  bgcolor: PUBLIC_COLORS.bgAlt,
  color: PUBLIC_COLORS.text,
};

export const glassCardSx = {
  bgcolor: PUBLIC_COLORS.glass,
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: `1px solid ${PUBLIC_COLORS.glassBorder}`,
  borderRadius: 2,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
};

export const publicCardSx = {
  bgcolor: PUBLIC_COLORS.surface,
  border: `1px solid ${PUBLIC_COLORS.border}`,
  borderRadius: 2,
  overflow: "hidden",
  transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
  "&:hover": {
    transform: "translateY(-3px)",
    boxShadow: PUBLIC_COLORS.cardShadow,
    borderColor: alpha(PUBLIC_COLORS.lime, 0.35),
  },
};

export const publicLightCardSx = {
  bgcolor: SHELL.cardBg,
  border: `1px solid ${PUBLIC_COLORS.borderLight}`,
  borderRadius: 2,
  boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
};

export const displayHeadingSx = {
  fontWeight: 800,
  letterSpacing: "-0.01em",
  lineHeight: 1.1,
  textTransform: "uppercase",
};

export const gradientTextSx = {
  color: PUBLIC_COLORS.lime,
};

export const publicCtaButtonSx = {
  bgcolor: PUBLIC_COLORS.lime,
  color: "#0B0F19",
  fontWeight: 700,
  px: 3,
  py: 1.25,
  borderRadius: 1.5,
  textTransform: "none",
  fontSize: "0.95rem",
  boxShadow: PUBLIC_COLORS.glowLime,
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  "&:hover": {
    bgcolor: PUBLIC_COLORS.limeDark,
    transform: "translateY(-1px)",
  },
};

export const publicOutlineButtonSx = {
  borderColor: alpha("#fff", 0.4),
  color: PUBLIC_COLORS.text,
  fontWeight: 600,
  px: 3,
  py: 1.25,
  borderRadius: 1.5,
  textTransform: "none",
  bgcolor: "transparent",
  "&:hover": {
    borderColor: PUBLIC_COLORS.lime,
    bgcolor: alpha(PUBLIC_COLORS.lime, 0.08),
  },
};

export const publicGhostButtonSx = {
  color: PUBLIC_COLORS.text,
  fontWeight: 500,
  px: 2,
  py: 1,
  borderRadius: 1.5,
  textTransform: "none",
  border: `1px solid ${PUBLIC_COLORS.glassBorder}`,
  "&:hover": { bgcolor: alpha("#fff", 0.06) },
};

export const statusChipColors = {
  upcoming: { bg: alpha("#F59E0B", 0.2), color: "#FBBF24" },
  live: { bg: alpha("#EF4444", 0.2), color: "#F87171" },
  finished: { bg: alpha("#64748B", 0.25), color: "#94A3B8" },
};

export const heroEntranceSx = {
  "@media (prefers-reduced-motion: no-preference)": {
    animation: "publicFadeUp 0.6s ease forwards",
    opacity: 0,
  },
  "@keyframes publicFadeUp": {
    from: { opacity: 0, transform: "translateY(16px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
};

export const courtThumbnailSx = {
  height: 160,
  background: `
    linear-gradient(180deg, transparent 0%, rgba(8,12,20,0.6) 100%),
    linear-gradient(135deg, ${alpha(PUBLIC_COLORS.primary, 0.4)} 0%, ${alpha(PUBLIC_COLORS.bgDeep, 0.95)} 100%),
    repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(255,255,255,0.03) 24px, rgba(255,255,255,0.03) 25px)
  `,
  position: "relative",
  overflow: "hidden",
};
