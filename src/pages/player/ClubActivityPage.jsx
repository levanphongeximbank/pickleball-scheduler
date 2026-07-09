import { Navigate } from "react-router-dom";

/** @deprecated Dùng /my-club?view=schedule */
export default function ClubActivityPage() {
  return <Navigate to="/my-club?view=schedule" replace />;
}
