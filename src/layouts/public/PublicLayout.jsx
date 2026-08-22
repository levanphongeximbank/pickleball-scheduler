import { Box, CssBaseline } from "@mui/material";
import { Outlet } from "react-router-dom";

import PublicHeader from "../../components/public/PublicHeader.jsx";
import PublicFooter from "../../components/public/PublicFooter.jsx";
import { PUBLIC_COLORS } from "../../components/public/publicPortalStyles.js";
import { TYPOGRAPHY } from "../../theme/designTokens.js";

/**
 * Public Web font isolation (Wave 2B): authenticated workspace uses Inter via
 * root theme; public routes keep DM Sans so PUBLIC_FONT_CHANGED=NO.
 */
export default function PublicLayout() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: PUBLIC_COLORS.bg,
        color: PUBLIC_COLORS.text,
        fontFamily: TYPOGRAPHY.publicFontFamily,
      }}
    >
      <CssBaseline />
      <PublicHeader />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <PublicFooter />
    </Box>
  );
}
