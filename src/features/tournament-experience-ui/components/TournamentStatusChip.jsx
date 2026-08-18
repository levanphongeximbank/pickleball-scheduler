import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Chip } from "@mui/material";

import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";

const MAP = {
  success: { color: TOURNAMENT_COLOR.success, surface: TOURNAMENT_COLOR.successSurface, Icon: CheckCircleOutlineIcon },
  live: { color: TOURNAMENT_COLOR.live, surface: TOURNAMENT_COLOR.liveSurface, Icon: FiberManualRecordIcon },
  warning: { color: TOURNAMENT_COLOR.warning, surface: TOURNAMENT_COLOR.warningSurface, Icon: WarningAmberIcon },
  danger: { color: TOURNAMENT_COLOR.danger, surface: TOURNAMENT_COLOR.dangerSurface, Icon: ErrorOutlineIcon },
  info: { color: TOURNAMENT_COLOR.primary, surface: TOURNAMENT_COLOR.primarySurface, Icon: InfoOutlinedIcon },
  draft: { color: TOURNAMENT_COLOR.textMuted, surface: "#F1F5F9", Icon: HourglassEmptyIcon },
};

export default function TournamentStatusChip({
  tone = "info",
  label,
  size = "small",
}) {
  const spec = MAP[tone] || MAP.info;
  const Icon = spec.Icon;
  return (
    <Chip
      size={size}
      icon={<Icon sx={{ fontSize: "14px !important", color: `${spec.color} !important` }} />}
      label={label}
      sx={{
        height: 24,
        fontWeight: 600,
        fontSize: 12,
        bgcolor: spec.surface,
        color: spec.color,
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}
