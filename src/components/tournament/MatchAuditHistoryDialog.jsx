import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import Button from "@mui/material/Button";

import { summarizeCombinedAudit } from "../../tournament/engines/scoreHistoryEngine.js";

export default function MatchAuditHistoryDialog({ open, match, liveRow, onClose }) {
  const lines = summarizeCombinedAudit(match, liveRow, 50);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Lịch sử trận đấu</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {(match?.entryALabel || match?.teamALabel || "Đội A")} vs{" "}
          {(match?.entryBLabel || match?.teamBLabel || "Đội B")}
        </Typography>

        {lines.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có thay đổi điểm nào được ghi nhận.
          </Typography>
        ) : (
          <List dense disablePadding>
            {lines.map((line, index) => (
              <ListItem key={`${line}-${index}`} disableGutters sx={{ py: 0.5 }}>
                <ListItemText
                  primary={line}
                  slotProps={{
                    primary: { variant: "body2", sx: { color: "text.secondary" } },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
