import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { isSubscriptionOperationalExemptRole } from "../../billing/guards/operationalRoutePolicy.js";
import {
  canAccessMobileRoute,
  getMobileRouteForbiddenMessage,
} from "../services/mobileNavAccess.js";

function MobileForbiddenState({ message }) {
  return (
    <Box
      sx={{
        py: 6,
        px: 3,
        textAlign: "center",
        maxWidth: 420,
        mx: "auto",
      }}
    >
      <LockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h6" fontWeight={800} gutterBottom>
        Không có quyền truy cập
      </Typography>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}

/**
 * Route guard cho /mobile/* — permission + subscription lock.
 */
export default function MobileRouteGate() {
  const location = useLocation();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const { subscriptionCheck, isSuperAdmin } = useTenant();

  const scope = {
    clubId: activeClubId,
    venueId: activeClub?.venueId || auth.user?.venueId || null,
    tenantId: activeClub?.tenantId || activeClub?.venueId || auth.user?.tenantId || null,
    playerId: auth.user?.playerId || null,
  };

  const subscriptionExempt =
    isSuperAdmin || isSubscriptionOperationalExemptRole(auth.user);
  const subscriptionOk = subscriptionCheck.ok || subscriptionExempt;
  const allowed = canAccessMobileRoute(location.pathname, auth, scope, {
    subscriptionOk,
    isSuperAdmin,
  });

  if (!auth.rbacEnabled) {
    return <Outlet />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowed) {
    if (location.pathname !== "/403") {
      const message = getMobileRouteForbiddenMessage(location.pathname, { subscriptionOk });
      return <MobileForbiddenState message={message} />;
    }
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
