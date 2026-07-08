import { Chip, Stack, Typography } from "@mui/material";
import { RATING_STATUS_LABELS } from "../constants/ratingStatus.js";
import { formatPickVnRating } from "../constants/pickVnRatingScale.js";
import { normalizeRatingStatus } from "../constants/ratingStatus.js";

const STATUS_COLORS = {
  unrated: "default",
  self_declared: "info",
  provisional: "warning",
  club_verified: "success",
  admin_verified: "success",
  system_verified: "primary",
  under_review: "warning",
  rejected: "error",
};

export default function PickVnRatingBadge({
  rating,
  status,
  confidence = null,
  size = "small",
}) {
  const normalizedStatus = normalizeRatingStatus(status);
  const label = RATING_STATUS_LABELS[normalizedStatus] || normalizedStatus;
  const color = STATUS_COLORS[normalizedStatus] || "default";

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
      <Chip
        size={size}
        label={`Pick_VN ${formatPickVnRating(rating)}`}
        color="primary"
        variant="outlined"
      />
      <Chip size={size} label={label} color={color} />
      {confidence != null && (
        <Typography variant="caption" color="text.secondary">
          Tin cậy {(Number(confidence) * 100).toFixed(0)}%
        </Typography>
      )}
    </Stack>
  );
}
