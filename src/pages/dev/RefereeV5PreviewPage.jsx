import { Box, Paper, Typography } from "@mui/material";

import { isRefereeV5Enabled } from "../../features/referee-v5/flags.js";
import RefereeV5PrototypePage from "../../features/referee-v5/prototype/RefereeV5PrototypePage.jsx";

export default function RefereeV5PreviewPage() {
  if (!isRefereeV5Enabled()) {
    return (
      <Box sx={{ p: 3, maxWidth: 720, mx: "auto" }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Referee V5 Prototype
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Feature flag đang tắt. Bật{" "}
            <Typography component="code" variant="body2">
              VITE_REFEREE_V5_ENABLED=true
            </Typography>{" "}
            trong môi trường local/preview để mở Court Visualizer prototype.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return <RefereeV5PrototypePage />;
}
