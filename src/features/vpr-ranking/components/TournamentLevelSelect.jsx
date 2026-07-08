import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import {
  TOURNAMENT_LEVEL_OPTIONS,
  VPR_ELIGIBLE_LEVELS,
} from "../../../models/tournament/constants.js";
import CertifiedTournamentBadge from "./CertifiedTournamentBadge.jsx";

export default function TournamentLevelSelect({
  value,
  onChange,
  certificationStatus,
  rankingEnabled,
  disabled = false,
}) {
  return (
    <Stack spacing={1}>
      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="tournament-level-label">Phân loại giải</InputLabel>
        <Select
          labelId="tournament-level-label"
          label="Phân loại giải"
          value={value || "community"}
          onChange={(event) => onChange(event.target.value)}
        >
          {TOURNAMENT_LEVEL_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
              {option.vprEligible ? " · VPR" : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {VPR_ELIGIBLE_LEVELS.includes(value) && (
        <Stack direction="row" spacing={1} alignItems="center">
          <CertifiedTournamentBadge
            certificationStatus={certificationStatus}
            tournamentLevel={value}
            rankingEnabled={rankingEnabled}
          />
          <Typography variant="caption" color="text.secondary">
            Giải VPR cần Super Admin duyệt trước khi tính điểm.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
