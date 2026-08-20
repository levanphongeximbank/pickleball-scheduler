import { Button, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { outlinedActionSx } from "../visual/tournamentExperienceTokens.js";
import {
  individualAwardsExperiencePath,
  individualCommunicationsPath,
  individualCompletePath,
  individualMediaPath,
} from "../routes.js";

export function BatchFNav({ tournamentId, eventId, current }) {
  const items = [
    { id: "communications", label: "Truyền thông", to: individualCommunicationsPath(tournamentId, eventId) },
    { id: "media", label: "Trình chiếu", to: individualMediaPath(tournamentId, eventId) },
    { id: "awards", label: "Giải thưởng", to: individualAwardsExperiencePath(tournamentId, eventId) },
    { id: "complete", label: "Hoàn tất", to: individualCompletePath(tournamentId, eventId) },
  ];
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Button
          key={item.id}
          size="small"
          component={RouterLink}
          to={item.to}
          variant={item.id === current ? "contained" : "outlined"}
          sx={item.id === current ? undefined : outlinedActionSx}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}
