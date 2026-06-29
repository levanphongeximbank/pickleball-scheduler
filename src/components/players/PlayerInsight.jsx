import { Box, Typography } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

export default function PlayerInsight({ text }) {
  if (!text) return null;

  return (
    <Box
      sx={{
        mt: 1.5,
        px: 1.25,
        py: 0.75,
        borderRadius: 1.5,
        bgcolor: "rgba(79, 70, 229, 0.06)",
        border: "1px solid rgba(79, 70, 229, 0.12)",
        display: "flex",
        alignItems: "flex-start",
        gap: 0.75,
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: 14, color: "#6366f1", mt: 0.25, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: "#4338ca", lineHeight: 1.45, fontWeight: 600 }}>
        {text}
      </Typography>
    </Box>
  );
}
