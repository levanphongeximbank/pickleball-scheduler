import { Box, Chip, Stack, Typography } from "@mui/material";

import { CALENDAR_CELL_TONES, CALENDAR_LEGEND_ITEMS } from "./courtCalendarTokens.js";

export default function CourtCalendarLegend() {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
      {CALENDAR_LEGEND_ITEMS.map((tone) => {
        const token = CALENDAR_CELL_TONES[tone];
        return (
          <Chip
            key={tone}
            size="small"
            label={token.label}
            sx={{
              bgcolor: token.bg,
              color: token.color,
              border: `1px solid ${token.border}`,
              fontWeight: 600,
            }}
          />
        );
      })}
    </Stack>
  );
}
