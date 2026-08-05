import { Box } from "@mui/material";

import GlobalSearch from "../../../components/GlobalSearch.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Global search trigger for Figure 1 top bar — reuses existing GlobalSearch.
 * Desktop + mobile share one search registry (legacy MENU_GROUPS until Phase 5).
 */
export default function CanonicalGlobalSearchTrigger() {
  const { isMobile } = useCanonicalShell();

  return (
    <Box
      sx={{
        flex: isMobile ? "0 1 auto" : 1,
        display: "flex",
        justifyContent: "center",
        minWidth: 0,
        maxWidth: isMobile ? 160 : 520,
      }}
      aria-label="Tìm kiếm toàn cục"
    >
      <GlobalSearch variant="light" maxWidth={isMobile ? 160 : 520} size="small" />
    </Box>
  );
}
