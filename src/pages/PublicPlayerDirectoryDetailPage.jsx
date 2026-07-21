/**
 * Phase 1I-D — Authenticated Public Player Directory detail page (/athletes/:playerId).
 */
import { Box } from "@mui/material";
import { useParams } from "react-router-dom";

import PublicDirectoryPlayerDetail from "../features/player/components/PublicDirectoryPlayerDetail.jsx";

export default function PublicPlayerDirectoryDetailPage() {
  const { playerId } = useParams();

  return (
    <Box sx={{ p: { xs: 0, md: 0.5 }, maxWidth: 720, mx: "auto" }}>
      <PublicDirectoryPlayerDetail playerId={playerId} />
    </Box>
  );
}
