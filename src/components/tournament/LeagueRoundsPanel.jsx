import { Link as RouterLink } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

export default function LeagueRoundsPanel({ title = "Vòng giải trong mùa", rounds = [] }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>
        <Chip size="small" label={`${rounds.length} vòng`} />
      </Stack>

      {rounds.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có vòng giải. Tạo giải mới sẽ tự gắn vào vòng trong mùa hiện tại.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rounds.slice(0, 6).map((round) => (
            <Box
              key={round.id}
              sx={{
                p: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography fontWeight="bold">{round.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {(round.tournamentIds || []).length} giải gắn vòng này
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      <Button
        size="small"
        component={RouterLink}
        to="/club"
        sx={{ mt: 1.5 }}
      >
        Quản lý vòng mùa
      </Button>
    </Paper>
  );
}
