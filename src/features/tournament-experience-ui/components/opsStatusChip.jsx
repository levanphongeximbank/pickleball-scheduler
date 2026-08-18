import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { displayStatusLabel } from "../copy/uiDisplayLabels.js";
import { opsStatusLabel, opsStatusTone } from "../liveOps/liveOpsStatus.js";

export function OpsStatusChip({ status, severity, size = "small" }) {
  const token = opsStatusLabel(status);
  return <TournamentStatusChip tone={opsStatusTone(token, severity)} label={displayStatusLabel(token)} size={size} />;
}
