import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseTeamPreview({
  diagnostics,
  teamCards = [],
  onRegenerate,
  onStartReveal,
  onCancelPreview,
  regenerateDisabled,
  regenerateReason,
  startDisabled,
  startReason,
}) {
  return (
    <Stack spacing={3} maxWidth={900} mx="auto" width="100%">
      <Typography component="h1" sx={showcaseTitleSx}>
        Xem trước đội (Owner)
      </Typography>

      <Box sx={showcaseCardSx}>
        <Stack spacing={1}>
          <Box>
            <strong>{diagnostics?.teamCount ?? 0}</strong> đội · chờ{" "}
            <strong>{diagnostics?.waitingListCount ?? 0}</strong>
          </Box>
          <Box sx={showcaseMutedSx}>
            TB rating: {Number(diagnostics?.averageRating || 0).toFixed(2)} · spread{" "}
            {Number(diagnostics?.balanceSpread || 0).toFixed(2)}
          </Box>
          <Box sx={showcaseMutedSx}>
            engineVersion: {diagnostics?.engineVersion || "—"} · rulesVersion:{" "}
            {diagnostics?.rulesVersion || "—"}
          </Box>
          <Box sx={showcaseMutedSx}>
            engineInputHash: {diagnostics?.engineInputHash || "—"}
          </Box>
          <Box sx={showcaseMutedSx}>
            engineOutputHash: {diagnostics?.engineOutputHash || "—"}
          </Box>
        </Stack>
      </Box>

      {!diagnostics?.allTeamsValid ? (
        <Alert severity="error">Một hoặc nhiều đội không đạt 4 VĐV / 2 nam + 2 nữ.</Alert>
      ) : null}
      {diagnostics?.duplicateAthleteIds?.length ? (
        <Alert severity="error">
          Trùng VĐV: {diagnostics.duplicateAthleteIds.join(", ")}
        </Alert>
      ) : null}

      <Box sx={showcaseCardSx}>
        {teamCards.map((team) => (
          <Box key={team.id} mb={1.5}>
            <Typography fontWeight={700}>{team.name}</Typography>
            <Box sx={showcaseMutedSx}>
              TB {Number(team.avgLevel || 0).toFixed(2)} · Nam {team.maleCount} · Nữ{" "}
              {team.femaleCount}
            </Box>
            <Box sx={showcaseMutedSx}>
              {(team.athletes || [])
                .map((athlete) => `${athlete.name} (${athlete.genderLabel})`)
                .join(" · ")}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onCancelPreview}>
          {SHOWCASE_COPY.cancelUnsaved}
        </Button>
        <Button
          variant="outlined"
          color="warning"
          disabled={regenerateDisabled}
          title={regenerateReason || ""}
          onClick={onRegenerate}
        >
          {SHOWCASE_COPY.regenerateTeams}
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={startDisabled}
          title={startReason || ""}
          onClick={onStartReveal}
        >
          {SHOWCASE_COPY.startTeamReveal}
        </Button>
      </Box>
    </Stack>
  );
}
