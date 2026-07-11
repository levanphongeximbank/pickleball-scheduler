import { MembershipRequestBadge } from "../../../features/club/ui/index.js";

/** @deprecated Use MembershipRequestBadge from features/club/ui */
export function requestStatusChip(status) {
  return <MembershipRequestBadge status={status} />;
}

export { MembershipRequestBadge };
