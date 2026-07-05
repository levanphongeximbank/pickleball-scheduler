import { Box, Typography } from "@mui/material";

import TournamentHome from "./TournamentHome.jsx";

export default function TournamentShell({ section = "overview" }) {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
        Giải đấu
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Quản lý giải nội bộ, giải mở và Daily Play.
      </Typography>

      <TournamentHome section={section} />
    </Box>
  );
}
