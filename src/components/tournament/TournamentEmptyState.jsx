import { Box, Typography } from "@mui/material";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";

export default function TournamentEmptyState({
  title,
  description,
  icon: Icon = EmojiEventsOutlinedIcon,
}) {
  return (
    <Box
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    >
      <Icon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}
