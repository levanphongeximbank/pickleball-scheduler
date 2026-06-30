import RefereeAssignDialog from "../../../../components/tournament/RefereeAssignDialog.jsx";
import MatchAuditHistoryDialog from "../../../../components/tournament/MatchAuditHistoryDialog.jsx";
import { resolveMatchLabels } from "../../../../tournament/engines/refereeEngine.js";

export default function DirectorActions({
  refereeDialogMatch,
  auditHistoryMatch,
  activeEvent,
  players,
  courts,
  refereeSettings,
  liveByMatchId,
  onCloseRefereeDialog,
  onCloseAuditDialog,
  onRefereeAssign,
}) {
  return (
    <>
      <RefereeAssignDialog
        open={Boolean(refereeDialogMatch)}
        match={refereeDialogMatch}
        matchLabels={
          refereeDialogMatch
            ? resolveMatchLabels(refereeDialogMatch, {
                entries: activeEvent?.entries || [],
                players,
                courts,
              })
            : null
        }
        existingReferee={refereeDialogMatch?.referee}
        roster={refereeSettings.roster}
        onClose={onCloseRefereeDialog}
        onAssign={onRefereeAssign}
      />

      <MatchAuditHistoryDialog
        open={Boolean(auditHistoryMatch)}
        match={auditHistoryMatch}
        liveRow={auditHistoryMatch ? liveByMatchId[String(auditHistoryMatch.id)] : null}
        onClose={onCloseAuditDialog}
      />
    </>
  );
}
