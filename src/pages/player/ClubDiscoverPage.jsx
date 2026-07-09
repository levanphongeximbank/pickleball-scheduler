import { Navigate } from "react-router-dom";

/** @deprecated Dùng /my-club?view=discover — giữ wrapper cho import cũ. */
export default function ClubDiscoverPage() {
  return <Navigate to="/my-club?view=discover" replace />;
}
