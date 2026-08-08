import { useState } from "react";

import { FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";

import { useCanonicalTournamentList } from "../../features/tournament/hooks/useCanonicalTournament.js";
import { TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import TournamentCourtSchedulePanel from "./TournamentCourtSchedulePanel.jsx";

export default function TournamentCourtScheduleManager({ clubId, courts = [], revision = 0, onSaved }) {
  const { tournaments: allTournaments = [] } = useCanonicalTournamentList(clubId, revision);
  const tournaments = allTournaments.filter(
    (item) =>
      item.status !== TOURNAMENT_STATUS.CANCELLED &&
      item.status !== TOURNAMENT_STATUS.COMPLETED
  );

  const [selectedId, setSelectedId] = useState("");

  const selectedTournament =
    tournaments.find((item) => item.id === selectedId) || null;

  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel>Chọn giải đấu</InputLabel>
        <Select
          label="Chọn giải đấu"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {tournaments.map((tournament) => (
            <MenuItem key={tournament.id} value={tournament.id}>
              {tournament.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedTournament ? (
        <TournamentCourtSchedulePanel
          clubId={clubId}
          tournament={selectedTournament}
          courts={courts}
          onSaved={onSaved}
        />
      ) : null}
    </Stack>
  );
}
