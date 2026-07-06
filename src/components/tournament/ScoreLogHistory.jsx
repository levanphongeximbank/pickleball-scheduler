import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";

import { summarizeCombinedAudit } from "../../tournament/engines/scoreHistoryEngine.js";
import { tournamentSectionTitleSx } from "./tournamentLayout.js";

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
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ ...tournamentSectionTitleSx, mb: 0.75 }}>{title}</Typography>
      <List dense disablePadding>
        {lines.map((line, index) => (
          <ListItem key={`${line}-${index}`} disableGutters sx={{ py: 0.25 }}>
            <ListItemText
              primary={line}
              slotProps={{
                primary: { variant: "caption", sx: { color: "text.secondary" } },
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
