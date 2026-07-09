import { Navigate, Outlet } from "react-router-dom";

/** @deprecated Gate bắt buộc đánh giá đã bỏ — giữ component để tránh break import cũ. */
export default function PickVnOnboardingGate() {
  return <Outlet />;
}

export function PickVnOnboardingRedirect() {
  return <Navigate to="/player/skill-assessment" replace />;
}
