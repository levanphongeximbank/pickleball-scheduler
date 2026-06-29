import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import RouteAccessGate from "../components/auth/RouteAccessGate.jsx";
import { ClubProvider } from "../context/ClubContext.jsx";
import { SeasonProvider } from "../context/SeasonContext.jsx";

export default function MainLayout() {
  return (
    <ClubProvider>
      <SeasonProvider>
        <Box sx={{ display: "flex" }}>
          <Header />

          <Sidebar />

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
            }}
          >
            <Toolbar />
            <RouteAccessGate>
              <Outlet />
            </RouteAccessGate>
          </Box>
        </Box>
      </SeasonProvider>
    </ClubProvider>
  );
}
