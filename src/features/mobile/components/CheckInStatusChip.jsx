import {
  CHECKIN_STATUS_COLORS,
  CHECKIN_STATUS_LABELS,
} from "../constants/checkInStatus.js";
import { StatusToneChip } from "../../web-app-ui/index.js";

const TONE_BY_STATUS_COLOR = Object.freeze({
  default: "neutral",
  success: "success",
  warning: "warning",
  error: "error",
});

export default function CheckInStatusChip({ status, size = "small" }) {
  const label = CHECKIN_STATUS_LABELS[status] || status;
  const color = CHECKIN_STATUS_COLORS[status] || "default";

  return (
    <StatusToneChip
      size={size}
      label={label}
      tone={TONE_BY_STATUS_COLOR[color] || "neutral"}
      sx={{
        fontWeight: 700,
        borderRadius: 999,
        px: 0.5,
      }}
    />
  );
}
