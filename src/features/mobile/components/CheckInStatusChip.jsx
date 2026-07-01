import { Chip } from "@mui/material";

import {
  CHECKIN_STATUS_COLORS,
  CHECKIN_STATUS_LABELS,
} from "../constants/checkInStatus.js";

export default function CheckInStatusChip({ status, size = "small" }) {
  const label = CHECKIN_STATUS_LABELS[status] || status;
  const color = CHECKIN_STATUS_COLORS[status] || "default";

  return (
    <Chip
      size={size}
      label={label}
      color={color}
      variant={color === "default" ? "outlined" : "filled"}
      sx={{
        fontWeight: 700,
        borderRadius: 999,
        px: 0.5,
        height: size === "small" ? 24 : 28,
      }}
    />
  );
}
