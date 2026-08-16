import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button, Stack } from "@mui/material";
import QrCode2Icon from "@mui/icons-material/QrCode2";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { getSupabaseAuthClient } from "../../auth/supabaseClient.js";
import { touchButtonSx } from "../../components/tournament/mobileUi.js";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";
import {
  createBrowserRefereeApplicationClient,
  RefereeHome,
  useCanonicalRefereeHome,
} from "../../features/referee-production-ui/index.js";
import "../../features/referee-production-ui/styles/referee-production.css";

/**
 * Production Referee Home / My Assignments.
 * CORE-13 assignments via canonical application client. Not legacy token hub.
 */
export default function RefereeHub({ client: clientProp }) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const isMobile = useIsMobile();

  const actor = useMemo(() => {
    if (!user?.id) return null;
    return {
      actorId: user.id,
      authUid: user.id,
      refereeId: user.id,
      role: "REFEREE",
    };
  }, [user]);

  const client = useMemo(() => {
    if (clientProp) return clientProp;
    return createBrowserRefereeApplicationClient({
      actor,
      env: typeof import.meta !== "undefined" ? import.meta.env : {},
      userClient: getSupabaseAuthClient(),
    });
  }, [actor, clientProp]);

  const home = useCanonicalRefereeHome({
    client,
    tenantId: currentTenantId,
    actor,
  });

  return (
    <>
      {isMobile ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2, px: 1.5 }}>
          <Button
            component={RouterLink}
            to="/mobile/qr-scan"
            variant="outlined"
            startIcon={<QrCode2Icon />}
            sx={touchButtonSx}
            fullWidth
          >
            Quét QR trận
          </Button>
        </Stack>
      ) : null}
      <RefereeHome
        assignments={home.assignments}
        loading={home.loading}
        error={home.error}
        userLabel={user?.displayName || "bạn"}
      />
    </>
  );
}
