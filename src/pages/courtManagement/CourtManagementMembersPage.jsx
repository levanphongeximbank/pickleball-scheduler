import { useOutletContext } from "react-router-dom";

import MemberList from "./MemberList.jsx";

export default function CourtManagementMembersPage() {
  const { clubId, courts, revision, onRefresh } = useOutletContext();

  return <MemberList clubId={clubId} courts={courts} revision={revision} onRefresh={onRefresh} />;
}
