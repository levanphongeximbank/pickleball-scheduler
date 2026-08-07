import { Box } from "@mui/material";

import CanonicalGlobalSearch from "./CanonicalGlobalSearch.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Global search trigger for Figure 1 top bar — canonical registry only.
 * Wave 4: parent zone supplies maxWidth so search cannot collide with org selector.
 */
export default function CanonicalGlobalSearchTrigger({ maxWidth } = {}) {
  const { isMobile } = useCanonicalShell();
  const resolvedMax = maxWidth ?? (isMobile ? 160 : 520);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        justifyContent: "center",
        minWidth: 0,
        maxWidth: "100%",
        width: "100%",
      }}
      aria-label="Tìm kiếm toàn cục"
      data-testid="canonical-topbar-search-trigger"
    >
      <CanonicalGlobalSearch maxWidth={resolvedMax} size="small" />
    </Box>
  );
}
