import { List, ListItem, ListItemText, Typography } from "@mui/material";

import { summarizeCombinedAudit } from "../../tournament/engines/scoreHistoryEngine.js";

export default function ScoreLogHistory({
  match,
  liveRow = null,
  title = "Lịch sử nhập điểm",
  limit = 12,
}) {
  const lines = summarizeCombinedAudit(match, liveRow, limit);

  if (!lines.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Chưa có lịch sử nhập điểm.
      </Typography>
    );
  }

  return (
    <>
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
        {title}
      </Typography>
      <List dense disablePadding>
        {lines.map((line, index) => (
          <ListItem key={`${line}-${index}`} disableGutters sx={{ py: 0.25 }}>
            <ListItemText
              primary={line}
              primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
