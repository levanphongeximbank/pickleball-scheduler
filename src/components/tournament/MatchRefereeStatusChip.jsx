import { Chip } from "@mui/material";

import {
  resolveRefereeMatchStatus,
  resolveRefereeStatusColor,
  resolveRefereeStatusLabel,
} from "../../tournament/engines/refereeStatusEngine.js";

export default function MatchRefereeStatusChip({ match, liveRow, size = "small" }) {
  const status = resolveRefereeMatchStatus(match, liveRow);
  const label = resolveRefereeStatusLabel(status);
  const color = resolveRefereeStatusColor(status);

  return <Chip size={size} label={label} color={color} variant={color === "default" ? "outlined" : "filled"} />;
}
