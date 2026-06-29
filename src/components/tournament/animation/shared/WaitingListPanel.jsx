import { Box, Stack, Typography } from "@mui/material";

export default function WaitingListPanel({ title, subtitle, children, emptyText = "Danh sách trống" }) {
  return (
    <Box className="tournament-anim-panel" sx={{ p: 1.25, height: "100%" }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {subtitle}
        </Typography>
      ) : null}
      <Stack spacing={0.75} sx={{ maxHeight: { xs: 280, md: 420 }, overflow: "auto" }}>
        {children ?? (
          <Typography variant="caption" color="text.secondary">
            {emptyText}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
