import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";

export default function EngineCourtsTab({ engine }) {
  const { courts, engineState, assignCourtsAuto } = engine;
  const assignments = engineState.courtResult?.assignments || [];
  const matches = engineState.matches || [];

  const courtUsage = new Map();
  matches.forEach((match) => {
    if (match.courtId) {
      courtUsage.set(match.courtId, (courtUsage.get(match.courtId) || 0) + 1);
    }
  });

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Button
          variant="contained"
          startIcon={<SportsTennisIcon />}
          onClick={() => assignCourtsAuto(false)}
        >
          Xếp sân tự động
        </Button>
        <Chip label={`Sân: ${courts.length}`} size="small" variant="outlined" />
        <Chip label={`Trận đã gán: ${matches.filter((match) => match.courtId).length}`} size="small" variant="outlined" />
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {courts.map((court) => (
          <Grid key={court.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight="medium">{court.name}</Typography>
                <Chip
                  size="small"
                  label={courtUsage.get(String(court.id)) ? "Đang dùng" : "Trống"}
                  color={courtUsage.get(String(court.id)) ? "primary" : "default"}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {courtUsage.get(String(court.id)) || 0} trận được gán
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {assignments.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Gán sân gần nhất
          </Typography>
          {assignments.slice(0, 10).map((item) => (
            <Typography key={item.matchId} variant="body2">
              {item.matchId} → {item.courtName}: {item.reason}
            </Typography>
          ))}
        </Paper>
      )}

      {courts.length === 0 && (
        <Alert severity="warning">Chưa có sân active. Thêm sân trong mục Sân.</Alert>
      )}
    </Box>
  );
}
