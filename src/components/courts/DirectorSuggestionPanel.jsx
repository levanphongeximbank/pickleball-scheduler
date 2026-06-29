import { Box, Paper, Stack, Typography } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

const priorityColors = {
  high: "#dc2626",
  medium: "#ca8a04",
  low: "#0f766e",
};

export default function DirectorSuggestionPanel({ suggestions = [] }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 2,
        border: "1px solid rgba(79, 70, 229, 0.2)",
        background: "linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(15,118,110,0.06) 100%)",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <AutoAwesomeIcon sx={{ color: "#6366f1", fontSize: 22 }} />
        <Typography variant="subtitle1" fontWeight={900}>
          AI Director Suggestion
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {suggestions.map((item, index) => (
          <Box
            key={`${item.type}-${index}`}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              px: 1.25,
              py: 1,
              borderRadius: 1.5,
              bgcolor: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(15,23,42,0.06)",
            }}
          >
            <LightbulbOutlinedIcon
              sx={{
                fontSize: 18,
                color: priorityColors[item.priority] || priorityColors.low,
                mt: 0.2,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {item.text}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
