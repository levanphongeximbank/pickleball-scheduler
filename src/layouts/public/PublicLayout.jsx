import { Box, CssBaseline } from "@mui/material";
import { Outlet } from "react-router-dom";

import PublicHeader from "../../components/public/PublicHeader.jsx";
import PublicFooter from "../../components/public/PublicFooter.jsx";
import { PUBLIC_COLORS } from "../../components/public/publicPortalStyles.js";

export default function PublicLayout() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: PUBLIC_COLORS.bg,
        color: PUBLIC_COLORS.text,
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
