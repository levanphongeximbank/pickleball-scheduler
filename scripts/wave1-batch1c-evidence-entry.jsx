/**
 * Batch 1C evidence harness — CanonicalTopBar Help + composition (canonical flag ON).
 * Extends 1A MainLayout harness with /tournament/:id/overview stand-in.
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
import { signInAs } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import theme from "../src/theme/theme.js";

// Local evidence identity so Help/Account chrome render (no Supabase).
signInAs(
  {
    id: "batch1c-evidence-user",
    email: "batch1c@evidence.local",
    displayName: "Tenant Owner",
    role: ROLES.TENANT_OWNER,
    tenantId: "tenant-evidence",
    venueId: "venue-evidence",
  },
  { provider: "dev" }
);

function resolveInitialPath() {
  const params = new URLSearchParams(window.location.search);
  const path = params.get("path") || "dashboard";
  if (path === "tournament-overview") return "/tournament/demo-safe-id/overview";
  if (path === "tournament") return "/tournament";
  return "/dashboard";
}

function PageBody({ title, note }) {
  return (
    <Box data-testid="batch1c-page-body" sx={{ p: 1 }}>
      <Typography variant="h5" fontWeight={800}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {note}
      </Typography>
    </Box>
  );
}

export default function Batch1CEvidenceApp() {
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
                    <PageBody
                      title="Tổng quan"
                      note="Batch 1C topbar evidence — Help / selectors / search / notification / account."
                    />
                  }
                />
                <Route
                  path="/tournament"
                  element={
                    <PageBody
                      title="Trung tâm giải đấu"
                      note="Batch 1C topbar evidence — outer chrome only; Experience internals frozen."
                    />
                  }
                />
                <Route
                  path="/tournament/:tournamentId/overview"
                  element={
                    <PageBody
                      title="Tổng quan giải (stand-in)"
                      note="Batch 1C — shared outer Topbar around overview context; ExperiencePageHeader not mounted."
                    />
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

createRoot(document.getElementById("root")).render(<Batch1CEvidenceApp />);
