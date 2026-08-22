/**
 * Wave 1 Batch 1D — context selectors for CanonicalMobileDrawer.
 * Reuses TenantSwitcher / VenueSwitcher / ClubSwitcher (no duplicate state).
 */
import { Box, Stack, Typography } from "@mui/material";

import CanonicalTenantSwitcher from "./CanonicalTenantSwitcher.jsx";
import ClubSwitcher from "../../../components/ClubSwitcher.jsx";
import VenueSwitcher from "../../../components/VenueSwitcher.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { useTenant } from "../../../context/TenantContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";

export default function CanonicalMobileDrawerContext() {
  const { palette } = useCanonicalShell();
  const { isSuperAdmin, currentTenantId } = useTenant();
  const { clubs, activeClubReady } = useClub();

  const showClubSwitcher =
    Boolean(currentTenantId) && (clubs.length > 1 || !activeClubReady || clubs.length === 1);

  return (
    <Box
      data-testid="canonical-mobile-drawer-context"
      sx={{
        px: 1.5,
        py: 1.25,
        borderBottom: `1px solid ${palette.sidebarBorder}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: palette.sidebarTextMuted, fontWeight: 700, letterSpacing: 0.4 }}
      >
        Ngữ cảnh
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {isSuperAdmin ? (
          <CanonicalTenantSwitcher minWidth={0} maxWidth="100%" />
        ) : null}
        <VenueSwitcher variant="context" minWidth={0} hideLabel={false} />
        {showClubSwitcher ? <ClubSwitcher variant="context" minWidth={0} /> : null}
      </Stack>
    </Box>
  );
}
