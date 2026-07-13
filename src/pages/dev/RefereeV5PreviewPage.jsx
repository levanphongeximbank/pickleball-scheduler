import { Box, Paper, Typography } from "@mui/material";

/**
 * Dev/preview shell for Referee V5.
 * The full prototype depends on `src/features/referee-v5/`, which is not merged
 * onto feature/competition-core-standardization yet. This page keeps the router
 * import resolvable until that module lands from feature/referee-v5-platform.
 */
export default function RefereeV5PreviewPage() {
  return (
    <Box sx={{ p: 3, maxWidth: 720, mx: "auto" }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Referee V5 Prototype
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Route preview đã được wire, nhưng module referee-v5 chưa có trên branch
          feature/competition-core-standardization. Court Visualizer prototype sẽ khả
          dụng sau khi merge feature/referee-v5-platform.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Khi module sẵn sàng, bật{" "}
          <Typography component="code" variant="body2">
            VITE_REFEREE_V5_ENABLED=true
          </Typography>{" "}
          trong môi trường local/preview.
        </Typography>
      </Paper>
    </Box>
  );
}
