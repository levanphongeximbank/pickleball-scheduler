import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

import { getCourtDisplayName } from "../../../../models/court.js";
import { resolveCourtRefereeName } from "../../../../tournament/engines/refereeEngine.js";

export default function DirectorCourtBoard({
  snapshot,
  courts,
  lockedCourtIds,
  refereeSettings,
  onToggleCourt,
  onCourtRefereeChange,
}) {
  return (
    <Grid size={{ xs: 12, lg: 4 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
          San
        </Typography>
        <Stack spacing={1}>
          {snapshot.courtStates.map((court, index) => {
            const locked = court.locked || lockedCourtIds.includes(String(court.id));
            const courtRefereeName = resolveCourtRefereeName(
              refereeSettings.courtReferees,
              refereeSettings.roster,
              court.id
            );
            const courtRefereeId = refereeSettings.courtReferees[String(court.id)] || "";

            return (
              <Paper key={court.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box>
                      <Typography fontWeight="bold">
                        {getCourtDisplayName(
                          courts.find((item) => String(item.id) === String(court.id)),
                          index
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {court.status}
                        {court.currentMatchId ? ` • ${court.currentMatchId}` : ""}
                        {courtRefereeName ? ` • TT: ${courtRefereeName}` : ""}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={locked ? <LockOpenIcon /> : <LockIcon />}
                      onClick={() => onToggleCourt(court.id, locked)}
                      disabled={Boolean(court.currentMatchId) && !locked}
                    >
                      {locked ? "Mở sân" : "Khóa sân"}
                    </Button>
                  </Stack>
                  {refereeSettings.roster.length > 0 && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Trọng tài sân</InputLabel>
                      <Select
                        label="Trọng tài sân"
                        value={courtRefereeId}
                        onChange={(event) => onCourtRefereeChange(court.id, event.target.value)}
                      >
                        <MenuItem value="">
                          <em>Không gán cố định</em>
                        </MenuItem>
                        {refereeSettings.roster.map((entry) => (
                          <MenuItem key={entry.id} value={entry.id}>
                            {entry.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>
    </Grid>
  );
}
