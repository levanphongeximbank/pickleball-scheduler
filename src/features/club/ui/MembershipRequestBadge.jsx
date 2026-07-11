import { Chip } from "@mui/material";

import {
  CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS,
  CLUB_MEMBERSHIP_REQUEST_STATUSES,
} from "../constants/clubMembershipRequestStatuses.js";

const STATUS_COLOR = {
  [CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING]: "warning",
  [CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED]: "success",
  [CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED]: "error",
  [CLUB_MEMBERSHIP_REQUEST_STATUSES.CANCELLED]: "default",
};

/** Membership request / discover card state badge. */
export default function MembershipRequestBadge({ status, size = "small", sx = {} }) {
  if (!status) {
    return null;
  }
  const label = CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS[status] || status;
  return (
    <Chip
      size={size}
      label={label}
      color={STATUS_COLOR[status] || "default"}
      sx={sx}
      aria-label={`Trạng thái yêu cầu: ${label}`}
    />
  );
}
