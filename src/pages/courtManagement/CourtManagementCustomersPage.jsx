import { useOutletContext } from "react-router-dom";

import CustomerList from "./CustomerList.jsx";

export default function CourtManagementCustomersPage() {
  const { clubId, courts, revision, onRefresh } = useOutletContext();

  return <CustomerList clubId={clubId} courts={courts} revision={revision} onRefresh={onRefresh} />;
}
