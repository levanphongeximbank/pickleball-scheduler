import { Navigate } from "react-router-dom";

/** @deprecated Dùng /discover-clubs — giữ wrapper cho import cũ. */
export default function ClubDiscoverPage() {
  return <Navigate to="/discover-clubs" replace />;
}
