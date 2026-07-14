import {
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

export default function IndividualTournamentSelector({
  tournaments = [],
  tournamentId = "",
  onSelect,
  label = "Giải cá nhân",
}) {
  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          value={tournamentId || ""}
          onChange={(event) => onSelect?.(event.target.value)}
        >
          <MenuItem value="">
            <em>— Chọn giải —</em>
          </MenuItem>
          {tournaments.map((tournament) => (
            <MenuItem key={tournament.id} value={tournament.id}>
              {tournament.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {!tournamentId && (
        <Alert severity="info">
          Chọn giải cá nhân để cấu hình (lưu vào club blob, không dùng dữ liệu demo đồng đội).
        </Alert>
      )}
      {tournaments.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Chưa có giải cá nhân trong CLB hiện tại.
        </Typography>
      )}
    </Stack>
  );
}
