import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES, normalizeRole } from "../../auth/roles.js";
import { needsPickVnOnboarding } from "../../features/pick-vn-rating/services/pickVnRatingService.js";

const ONBOARDING_PATH = "/onboarding/pick-vn-rating";

export default function PickVnOnboardingGate() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user?.id) {
    return <Outlet />;
  }

  const role = normalizeRole(user.role);
  const isPlayer = role === ROLES.PLAYER;
  const onOnboardingPage = location.pathname.startsWith(ONBOARDING_PATH);

  if (isPlayer && needsPickVnOnboarding(user.id) && !onOnboardingPage) {
    return <Navigate to={ONBOARDING_PATH} replace state={{ from: location.pathname }} />;
  }

  if (onOnboardingPage && !needsPickVnOnboarding(user.id)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
