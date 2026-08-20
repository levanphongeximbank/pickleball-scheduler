import { Button, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { outlinedActionSx } from "../visual/tournamentExperienceTokens.js";
import {
  individualBracketPath,
  individualKnockoutPath,
  individualMatchesPath,
  individualSchedulePath,
  individualStandingsPath,
} from "../routes.js";

export function BatchDSiblingNav({ tournamentId, eventId, current }) {
  const items = [
    { id: "schedule", label: "Lịch & sân", to: individualSchedulePath(tournamentId, eventId) },
    { id: "matches", label: "Trung tâm trận", to: individualMatchesPath(tournamentId, eventId) },
    { id: "standings", label: "Kết quả & BXH", to: individualStandingsPath(tournamentId, eventId) },
    { id: "knockout", label: "Loại trực tiếp", to: individualKnockoutPath(tournamentId, eventId) },
    { id: "bracket", label: "Nhánh đấu", to: individualBracketPath(tournamentId, eventId) },
  ];
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Button
          key={item.id}
          size="small"
          component={RouterLink}
          to={item.to}
          variant={item.current === current || item.id === current ? "contained" : "outlined"}
          sx={item.id === current ? undefined : outlinedActionSx}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}
