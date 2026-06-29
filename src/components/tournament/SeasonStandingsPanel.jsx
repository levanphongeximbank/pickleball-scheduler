import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

export default function SeasonStandingsPanel({ title = "BXH mùa giải", rows = [], leagueName = "" }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">
            {title}
          </Typography>
          {leagueName ? (
            <Typography variant="body2" color="text.secondary">
              {leagueName}
            </Typography>
          ) : null}
        </Box>
        <Chip size="small" label={`${rows.length} VĐV`} />
      </Stack>

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có điểm mùa giải. Nhập kết quả trận trong giải hoặc Daily Play để tích lũy điểm.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {rows.slice(0, 8).map((row, index) => (
            <Stack
              key={row.playerId}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                py: 0.5,
                borderBottom: index < Math.min(rows.length, 8) - 1 ? "1px solid" : "none",
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" sx={{ flex: 1, pr: 1 }}>
                <Box component="span" sx={{ fontWeight: index < 3 ? "bold" : "regular", mr: 1 }}>
                  {index + 1}.
                </Box>
                {row.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {row.rating != null ? (
                  <Typography variant="caption" color="text.secondary">
                    Elo {row.rating}
                  </Typography>
                ) : null}
                <Chip size="small" color={index === 0 ? "primary" : "default"} label={`${row.points} đ`} />
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
