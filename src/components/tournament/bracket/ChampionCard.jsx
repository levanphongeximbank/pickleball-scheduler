import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { Button, Paper, Typography } from "@mui/material";

export default function ChampionCard({
  champion,
  revealed = false,
  celebrate = false,
  style,
  onViewSummary,
}) {
  const hasChampion = Boolean(champion?.name);

  return (
    <Paper
      className={`tournament-bracket-champion${
        revealed ? " tournament-bracket-champion--visible" : ""
      }${hasChampion ? " tournament-bracket-champion--won" : ""}${
        celebrate ? " tournament-bracket-champion--celebrate" : ""
      }`}
      variant="outlined"
      style={style}
    >
      <EmojiEventsIcon
        className={`tournament-bracket-champion__trophy${
          hasChampion ? " tournament-bracket-champion__trophy--active" : ""
        }`}
      />
      <Typography variant="overline" fontWeight={800} color="warning.dark">
        Nhà vô địch
      </Typography>
      <Typography variant="h6" fontWeight={900} sx={{ wordBreak: "break-word", mt: 0.5 }}>
        {hasChampion ? champion.name : "Chờ đội vô địch"}
      </Typography>
      {!hasChampion ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          Hoàn tất trận chung kết để công bố
        </Typography>
      ) : null}
      {hasChampion && onViewSummary ? (
        <Button size="small" variant="contained" color="warning" sx={{ mt: 1.25 }} onClick={onViewSummary}>
          Xem bảng tổng kết
        </Button>
      ) : null}
    </Paper>
  );
}
