import { Box, Button, FormControl, MenuItem, Select, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseBadgeSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseCaptainReveal({
  teamCards = [],
  onContinue,
  onBack,
  onAssignCaptain,
  readOnly = false,
}) {
  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        Công bố đội trưởng
      </Typography>
      <Stack spacing={2}>
        {teamCards.map((team) => {
          const captain = (team.athletes || []).find((a) => a.isCaptain);
          return (
            <Box key={team.id} sx={showcaseCardSx}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={800} fontSize="1.25rem">
                    {team.name}
                  </Typography>
                  <Box sx={showcaseMutedSx}>
                    {(team.athletes || []).map((a) => a.name).join(" · ")}
                  </Box>
                </Box>
                <Stack spacing={1} alignItems={{ xs: "stretch", sm: "flex-end" }}>
                  <Box sx={showcaseBadgeSx}>
                    {captain?.name || SHOWCASE_COPY.missingCaptain}
                  </Box>
                  {!readOnly && onAssignCaptain ? (
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <Select
                        value={team.captainPlayerId || captain?.id || ""}
                        displayEmpty
                        onChange={(event) =>
                          onAssignCaptain(team.id, event.target.value)
                        }
                      >
                        <MenuItem value="" disabled>
                          Đổi đội trưởng
                        </MenuItem>
                        {(team.athletes || []).map((athlete) => (
                          <MenuItem key={athlete.id} value={athlete.id}>
                            {athlete.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Quay lại xem đội
        </Button>
        <Button variant="contained" color="success" onClick={onContinue}>
          {SHOWCASE_COPY.continueGroups}
        </Button>
      </Box>
    </Stack>
  );
}
