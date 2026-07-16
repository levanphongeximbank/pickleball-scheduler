import { Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseBadgeSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseCaptainReveal({ teamCards = [], onContinue, onBack }) {
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
                <Box>
                  <Typography fontWeight={800} fontSize="1.25rem">
                    {team.name}
                  </Typography>
                  <Box sx={showcaseMutedSx}>
                    {(team.athletes || []).map((a) => a.name).join(" · ")}
                  </Box>
                </Box>
                <Box sx={showcaseBadgeSx}>
                  {captain?.name || SHOWCASE_COPY.missingCaptain}
                </Box>
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
