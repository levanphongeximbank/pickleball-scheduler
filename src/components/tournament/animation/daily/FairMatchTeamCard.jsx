import PersonIcon from "@mui/icons-material/Person";
import { Box, Paper, Stack, Typography } from "@mui/material";

export default function FairMatchTeamCard({
  team,
  side = "a",
  visible = false,
  active = false,
  flying = false,
}) {
  const players = team?.players || [];
  const isTeamA = side === "a";

  return (
    <Paper
      variant="outlined"
      className={`daily-fair-team-card daily-fair-team-card--${isTeamA ? "a" : "b"}${
        visible ? " daily-fair-team-card--visible" : ""
      }${active ? " daily-fair-team-card--active" : ""}${
        flying ? " daily-fair-team-card--fly" : ""
      }`}
    >
      <Box className="daily-fair-team-card__accent" />
      <Typography variant="overline" fontWeight={800} className="daily-fair-team-card__title">
        {isTeamA ? "Team A" : "Team B"}
      </Typography>

      <Stack spacing={1.25} sx={{ mt: 1 }}>
        {players.length === 0 ? (
          <Typography variant="h6" fontWeight={700}>
            {team?.label || "—"}
          </Typography>
        ) : (
          players.map((player) => (
            <Stack key={player.id} direction="row" spacing={1.25} alignItems="center">
              <Box className={`daily-fair-team-avatar daily-fair-team-avatar--${isTeamA ? "a" : "b"}`}>
                <PersonIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={700} noWrap title={player.name}>
                  {player.name}
                </Typography>
                {player.rating != null && (
                  <Typography variant="body2" color="text.secondary">
                    Level {player.rating}
                  </Typography>
                )}
              </Box>
            </Stack>
          ))
        )}
      </Stack>
    </Paper>
  );
}
