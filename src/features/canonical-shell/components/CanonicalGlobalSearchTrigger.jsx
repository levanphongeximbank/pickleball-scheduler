import { Box } from "@mui/material";

import CanonicalGlobalSearch from "./CanonicalGlobalSearch.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Global search trigger for Figure 1 top bar — canonical registry only.
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
      <CanonicalGlobalSearch maxWidth={isMobile ? 160 : 520} size="small" />
    </Box>
  );
}
