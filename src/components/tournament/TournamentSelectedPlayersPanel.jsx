import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

export default function TournamentSelectedPlayersPanel({
  title = "VĐV đã chọn",
  players = [],
  onRemove,
  emptyMessage = "Chưa chọn VĐV nào.",
  maxHeight = 360,
  showClubName = false,
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        {title} ({players.length})
      </Typography>
      <Stack spacing={1} sx={{ maxHeight, overflow: "auto" }}>
        {players.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          players.map((player) => (
            <Paper key={player.id} variant="outlined" sx={{ p: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="bold" noWrap>
                    {player.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {player.gender || "?"}
                    {" • "}
                    {player.rating ?? player.level ?? "-"}
                    {showClubName && player.clubName ? ` • ${player.clubName}` : ""}
                  </Typography>
                </Stack>
                <Tooltip title="Xóa khỏi danh sách">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Xóa ${player.name} khỏi danh sách`}
                    onClick={() => onRemove(player.id)}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Paper>
  );
}
