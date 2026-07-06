import { Chip } from "@mui/material";

import {
  TOURNAMENT_MODE_LABELS,
  TOURNAMENT_STATUS_LABELS,
  tournamentStatusChipProps,
} from "./tournamentLayout.js";

export function TournamentModeChip({ mode, size = "small", ...rest }) {
  const label = TOURNAMENT_MODE_LABELS[mode] || mode;
  return <Chip size={size} label={label} variant="outlined" {...rest} />;
}

export function TournamentStatusChip({ status, size = "small", ...rest }) {
  const label = TOURNAMENT_STATUS_LABELS[status] || status;
  const chipProps = tournamentStatusChipProps(status);
  return <Chip size={size} label={label} {...chipProps} {...rest} />;
}
