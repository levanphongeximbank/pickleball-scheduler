import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { Button, Chip, IconButton, Stack, Typography } from "@mui/material";

export default function BracketHeader({
  tournamentName = "Giải đấu",
  categoryLabel = "",
  presentationMode = false,
  soundEnabled = false,
  onBack,
  onTogglePresentation,
  onToggleSound,
  onOpenResults,
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      spacing={1}
      className="tournament-bracket-header"
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {onBack ? (
          <IconButton onClick={onBack} size="small" aria-label="Quay lại">
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <EmojiEventsIcon sx={{ color: "#0d47a1" }} />
        <BoxTitle tournamentName={tournamentName} categoryLabel={categoryLabel} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {onTogglePresentation ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={presentationMode ? <FullscreenExitIcon /> : <FullscreenIcon />}
            onClick={onTogglePresentation}
          >
            {presentationMode ? "Thoát trình chiếu" : "Trình chiếu"}
          </Button>
        ) : null}
        {onToggleSound ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={soundEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            onClick={() => onToggleSound(!soundEnabled)}
          >
            Âm thanh
          </Button>
        ) : null}
        {onOpenResults ? (
          <Button size="small" variant="contained" onClick={onOpenResults}>
            Xem kết quả
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}

function BoxTitle({ tournamentName, categoryLabel }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="h6" fontWeight={800}>
        {tournamentName}
      </Typography>
      {categoryLabel ? (
        <Chip size="small" label={categoryLabel} sx={{ alignSelf: "flex-start" }} />
      ) : null}
    </Stack>
  );
}
