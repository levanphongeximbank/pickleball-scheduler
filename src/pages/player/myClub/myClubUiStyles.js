import { PALETTE } from "../../../theme/designTokens.js";

export const segmentedTabBarSx = {
  display: "inline-flex",
  p: 0.5,
  borderRadius: 2,
  bgcolor: PALETTE.divider,
  flexWrap: "wrap",
  gap: 0.5,
};

export function segmentedTabSx(active) {
  return {
    px: 2,
    py: 0.75,
    minWidth: "auto",
    borderRadius: 1.5,
    textTransform: "none",
    fontWeight: 600,
    boxShadow: active ? "0 1px 3px rgba(15, 23, 42, 0.12)" : "none",
    bgcolor: active ? "background.paper" : "transparent",
    color: active ? "primary.main" : "text.secondary",
    "&:hover": {
      bgcolor: active ? "background.paper" : "rgba(255,255,255,0.5)",
    },
  };
}

export const heroGradientSx = {
  background: `linear-gradient(135deg, ${PALETTE.success.light} 0%, #FFFFFF 55%)`,
  borderBottom: `1px solid ${PALETTE.divider}`,
};

export const statBoxSx = {
  p: 1.5,
  borderRadius: 2,
  border: `1px solid ${PALETTE.divider}`,
  bgcolor: "background.paper",
  flex: 1,
  minWidth: 140,
};

export const miniGovernanceCardSx = (accent = "default") => {
  const accents = {
    president: { borderColor: "warning.light" },
    vice: { borderColor: "primary.light" },
    members: { borderColor: PALETTE.divider },
  };
  const style = accents[accent] || accents.members;
  return {
    p: 1.5,
    borderRadius: 2,
    border: "1px solid",
    borderColor: style.borderColor,
    bgcolor:
      accent === "president"
        ? "warning.light"
        : accent === "vice"
          ? "primary.light"
          : "background.paper",
    ...(accent === "president" ? { backgroundColor: "rgba(254, 243, 199, 0.45)" } : {}),
    ...(accent === "vice" ? { backgroundColor: "rgba(209, 250, 229, 0.45)" } : {}),
  };
};

export function clubAvatarColor(name = "") {
  const palette = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function clubInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "CL";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
