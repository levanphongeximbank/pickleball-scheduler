/**
 * Phase 1I-C — Authenticated Public Player Directory page (/athletes).
 */
import { Box } from "@mui/material";

import PublicPlayerDirectoryList from "../features/player/components/PublicPlayerDirectoryList.jsx";

export default function PublicPlayerDirectoryPage() {
  return (
    <Box sx={{ p: { xs: 0, md: 0.5 }, maxWidth: 1100, mx: "auto" }}>
      <PublicPlayerDirectoryList />
    </Box>
  );
}
