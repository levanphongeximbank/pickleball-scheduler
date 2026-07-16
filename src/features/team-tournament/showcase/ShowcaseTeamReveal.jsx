import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseBadgeSx,
  showcaseMutedSx,
  showcaseTeamCardSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

function AthleteRow({ athlete, visible }) {
  if (!visible) return null;
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{
        py: 1,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Box>
        <Box fontWeight={700}>{athlete.name}</Box>
        <Box sx={showcaseMutedSx}>{athlete.genderLabel}</Box>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {athlete.isCaptain ? (
          <Chip size="small" color="success" label="Đội trưởng" />
        ) : null}
        <Box fontWeight={800} color="#7CFFB2">
          {Number(athlete.ratingValue || 0).toFixed(1)}
        </Box>
      </Stack>
    </Stack>
  );
}

export default function ShowcaseTeamReveal({
  teamCards = [],
  teamIndex = 0,
  athleteIndex = 4,
  showAll = false,
  paused,
  onPause,
  onResume,
  onPrev,
  onNext,
  onShowAll,
  onReplayTeam,
  onContinue,
}) {
  const team = teamCards[Math.min(teamIndex, Math.max(teamCards.length - 1, 0))];
  if (!team) {
    return <Typography sx={showcaseTitleSx}>Chưa có đội để công bố</Typography>;
  }

  const visibleCount = showAll ? 4 : Math.min(athleteIndex + 1, 4);
  const showAvg = showAll || athleteIndex >= 3;
  const showCaptain = showAll || athleteIndex >= 4;

  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        Công bố đội {teamIndex + 1}/{teamCards.length}
      </Typography>

      <Box sx={showcaseTeamCardSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography fontSize="1.75rem" fontWeight={800}>
              {team.name}
            </Typography>
            <Box sx={showcaseMutedSx}>Hạt giống #{team.seed}</Box>
          </Box>
          <Stack direction="row" spacing={1}>
            {team.genderOk ? <Box sx={showcaseBadgeSx}>2 Nam + 2 Nữ</Box> : null}
            {team.balanced ? <Box sx={showcaseBadgeSx}>Cân bằng</Box> : null}
          </Stack>
        </Stack>

        {(team.athletes || []).slice(0, 4).map((athlete, index) => (
          <AthleteRow
            key={athlete.id}
            athlete={athlete}
            visible={index < visibleCount}
          />
        ))}

        {showAvg ? (
          <Box mt={2} fontWeight={800} fontSize="1.25rem">
            Trung bình đội: {Number(team.avgLevel || 0).toFixed(2)}
          </Box>
        ) : null}

        {showCaptain ? (
          <Box mt={1.5} sx={showcaseBadgeSx}>
            {team.captainPlayerId
              ? `Đội trưởng: ${
                  team.athletes.find((a) => a.isCaptain)?.name || team.captainPlayerId
                }`
              : SHOWCASE_COPY.missingCaptain}
          </Box>
        ) : null}
      </Box>

      <Box sx={showcaseActionsSx}>
        {paused ? (
          <Button variant="contained" color="success" onClick={onResume}>
            Tiếp tục
          </Button>
        ) : (
          <Button variant="outlined" color="inherit" onClick={onPause}>
            Tạm dừng
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onPrev} disabled={teamIndex <= 0}>
          Đội trước
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onNext}
          disabled={teamIndex >= teamCards.length - 1 && visibleCount >= 4}
        >
          Đội tiếp theo
        </Button>
        <Button variant="text" color="inherit" onClick={onShowAll}>
          Hiện tất cả
        </Button>
        <Button variant="text" color="inherit" onClick={onReplayTeam}>
          Chiếu lại đội này
        </Button>
        {teamIndex >= teamCards.length - 1 && visibleCount >= 4 ? (
          <Button variant="contained" color="success" onClick={onContinue}>
            Tiếp tục
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
