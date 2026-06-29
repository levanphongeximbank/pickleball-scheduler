import { Box, Button, Paper, Stack, Typography } from "@mui/material";

export default function BracketSidebar({
  rounds = [],
  teamCount = 0,
  formatLabel = "Loại trực tiếp",
  startDate = "",
  venue = "",
  activeRoundKey = "",
  onSelectRound,
  onOpenDetails,
}) {
  return (
    <Stack spacing={1.5} className="tournament-bracket-sidebar">
      <Paper variant="outlined" className="tournament-anim-panel" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
          Vòng đấu
        </Typography>
        <Stack spacing={0.75}>
          {rounds.map((round) => {
            const active = round.key === activeRoundKey;

            return (
              <Button
                key={round.key}
                variant={active ? "contained" : "outlined"}
                size="small"
                onClick={() => onSelectRound?.(round.key)}
                sx={{ justifyContent: "space-between" }}
              >
                <span>{round.displayName}</span>
                <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.85 }}>
                  {round.matches.length} trận
                </Typography>
              </Button>
            );
          })}
        </Stack>
      </Paper>

      <Paper variant="outlined" className="tournament-anim-panel" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
          Thông tin giải đấu
        </Typography>
        <Stack spacing={0.75}>
          <InfoRow label="Số đội" value={teamCount || "—"} />
          <InfoRow label="Thể thức" value={formatLabel} />
          <InfoRow label="Ngày bắt đầu" value={startDate || "—"} />
          <InfoRow label="Địa điểm" value={venue || "—"} />
        </Stack>
        {onOpenDetails ? (
          <Button fullWidth size="small" variant="text" sx={{ mt: 1 }} onClick={onOpenDetails}>
            Chi tiết giải đấu
          </Button>
        ) : null}
      </Paper>
    </Stack>
  );
}

function InfoRow({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}
