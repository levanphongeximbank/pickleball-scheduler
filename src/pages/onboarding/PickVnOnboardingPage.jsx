import { Navigate } from "react-router-dom";

/** @deprecated Dùng /player/skill-assessment — giữ redirect cho bookmark cũ. */
export default function PickVnOnboardingPage() {
  return <Navigate to="/player/skill-assessment" replace />;
}
