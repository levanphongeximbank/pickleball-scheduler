import { Chip, Tooltip } from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import BlockIcon from "@mui/icons-material/Block";

import {
  CERTIFICATION_STATUS,
  CERTIFICATION_STATUS_LABELS,
  VPR_ELIGIBLE_LEVELS,
} from "../../../models/tournament/constants.js";

const STATUS_COLORS = {
  [CERTIFICATION_STATUS.APPROVED]: "success",
  [CERTIFICATION_STATUS.PENDING]: "warning",
  [CERTIFICATION_STATUS.REJECTED]: "error",
  [CERTIFICATION_STATUS.NOT_REQUIRED]: "default",
};

export default function CertifiedTournamentBadge({
  certificationStatus,
  tournamentLevel,
  rankingEnabled = false,
  size = "small",
}) {
  if (!VPR_ELIGIBLE_LEVELS.includes(tournamentLevel)) {
    return null;
  }

  const status = certificationStatus || CERTIFICATION_STATUS.NOT_REQUIRED;
  const label =
    status === CERTIFICATION_STATUS.APPROVED && rankingEnabled
      ? "Pick_VN Certified"
      : CERTIFICATION_STATUS_LABELS[status] || status;

  const icon =
    status === CERTIFICATION_STATUS.APPROVED ? (
      <VerifiedIcon />
    ) : status === CERTIFICATION_STATUS.PENDING ? (
      <HourglassEmptyIcon />
    ) : status === CERTIFICATION_STATUS.REJECTED ? (
      <BlockIcon />
    ) : undefined;

  return (
    <Tooltip title={CERTIFICATION_STATUS_LABELS[status] || ""}>
      <Chip
        size={size}
        icon={icon}
        label={label}
        color={STATUS_COLORS[status] || "default"}
        variant={status === CERTIFICATION_STATUS.APPROVED ? "filled" : "outlined"}
      />
    </Tooltip>
  );
}
