import { Button, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { outlinedActionSx } from "../visual/tournamentExperienceTokens.js";
import {
  individualCourtsPath,
  individualDirectorPath,
  individualExceptionsPath,
  individualRefereesPath,
} from "../routes.js";

export function BatchESiblingNav({ tournamentId, eventId, current }) {
  const items = [
    { id: "director", label: "Điều hành giải", to: individualDirectorPath(tournamentId, eventId) },
    { id: "courts", label: "Bảng sân", to: individualCourtsPath(tournamentId, eventId) },
    { id: "referees", label: "Trọng tài", to: individualRefereesPath(tournamentId, eventId) },
    { id: "exceptions", label: "Xử lý sự cố", to: individualExceptionsPath(tournamentId, eventId) },
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
