import { Chip } from "@mui/material";

import { CLUB_STATUS_LABELS } from "../constants/clubStatus.js";

const STATUS_COLOR = {
  active: "success",
  pending_approval: "warning",
  pending_setup: "info",
  inactive: "default",
};

/** Club entity status badge (active / pending_approval / …). */
export default function ClubStatusBadge({ status, size = "small", sx = {} }) {
  const label = CLUB_STATUS_LABELS[status] || status || "—";
  return (
    <Chip
      size={size}
      label={label}
      color={STATUS_COLOR[status] || "default"}
      sx={sx}
      aria-label={`Trạng thái CLB: ${label}`}
    />
  );
}
