import { Chip } from "@mui/material";

import {
  CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS,
  CLUB_MEMBERSHIP_REQUEST_STATUSES,
} from "../../../features/club/index.js";

export function requestStatusChip(status) {
  const label = CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS[status] || status;
  const color =
    status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING
      ? "warning"
      : status === CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED
        ? "success"
        : status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED
          ? "error"
          : "default";
  return <Chip size="small" label={label} color={color} />;
}
