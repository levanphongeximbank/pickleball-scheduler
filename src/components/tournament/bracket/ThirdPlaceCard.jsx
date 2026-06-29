import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import { Paper, Typography } from "@mui/material";

export default function ThirdPlaceCard({ match, team }) {
  const label = team?.name || match?.winner?.name || "Chờ kết quả";

  return (
    <Paper className="tournament-bracket-third" variant="outlined" sx={{ mt: 2 }}>
      <MilitaryTechIcon sx={{ color: "#ef6c00", fontSize: 32, mb: 0.5 }} />
      <Typography variant="overline" fontWeight={800} color="warning.main">
        Hạng ba
      </Typography>
      <Typography variant="h6" fontWeight={800} sx={{ wordBreak: "break-word" }}>
        {label}
      </Typography>
      {match?.code ? (
        <Typography variant="caption" color="text.secondary">
          {match.code}
        </Typography>
      ) : null}
    </Paper>
  );
}
