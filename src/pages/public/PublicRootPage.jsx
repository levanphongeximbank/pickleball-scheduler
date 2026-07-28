import { Navigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { PublicLoadingState } from "../../components/public/states/index.js";
import HomePage from "../../pages/public/HomePage.jsx";

/** Root `/` — guests see public home; authenticated users go to dashboard. */
export default function PublicRootPage() {
  const { authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return (
      <PublicLoadingState
        title="Đang tải cổng công khai…"
        message="Vui lòng chờ trong giây lát."
      />
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <HomePage />;
}
