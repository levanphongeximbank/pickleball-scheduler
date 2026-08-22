/**
 * Batch 1A evidence harness — mounts MainLayout chrome only (no full router.jsx).
 * Avoids unrelated client imports that crash local Vite (e.g. node:crypto dry-run modules).
 */
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import MainLayout from "../src/layouts/MainLayout.jsx";
import { AuthProvider } from "../src/context/AuthContext.jsx";
import { PlatformRuntimeProvider } from "../src/core/platform/app/PlatformRuntimeProvider.jsx";
import theme from "../src/theme/theme.js";

function resolveInitialPath() {
  const params = new URLSearchParams(window.location.search);
  return params.get("path") === "tournament" ? "/tournament" : "/dashboard";
}

export default function Batch1AEvidenceApp() {
  const path = resolveInitialPath();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PlatformRuntimeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route element={<MainLayout />}>
                <Route
                  path="/dashboard"
                  element={
                    <Box data-testid="batch1a-page-body" sx={{ p: 1 }}>
                      <Typography variant="h5" fontWeight={800}>
                        Tổng quan
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Batch 1A shell exclusivity evidence — page body renders inside a single app
                        chrome.
                      </Typography>
                    </Box>
                  }
                />
                <Route
                  path="/tournament"
                  element={
                    <Box data-testid="batch1a-page-body" sx={{ p: 1 }}>
                      <Typography variant="h5" fontWeight={800}>
                        Trung tâm giải đấu
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Batch 1A shell exclusivity evidence — page body renders inside a single app
                        chrome.
                      </Typography>
                    </Box>
                  }
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </PlatformRuntimeProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Batch1AEvidenceApp />);
