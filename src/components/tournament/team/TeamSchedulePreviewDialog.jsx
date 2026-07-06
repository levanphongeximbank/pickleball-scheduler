import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

import TeamTournamentScheduleDiagram from "./TeamTournamentScheduleDiagram.jsx";

export default function TeamSchedulePreviewDialog({
  open,
  onClose,
  teamData,
  tournamentName = "",
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Xem sơ đồ trước</DialogTitle>
      <DialogContent dividers>
        <TeamTournamentScheduleDiagram
          teamData={teamData}
          tournamentName={tournamentName}
          defaultViewMode="unified"
          compact
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
