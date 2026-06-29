import { FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";

import { useSeasonLeague } from "../context/SeasonContext.jsx";

export default function SeasonLeagueSwitcher({ size = "small" }) {
  const {
    seasons,
    leaguesForActiveSeason,
    activeSeasonId,
    activeLeagueId,
    setActiveSeason,
    setActiveLeague,
  } = useSeasonLeague();

  return (
    <Stack direction="row" spacing={1}>
      <FormControl size={size} sx={{ minWidth: 140 }}>
        <InputLabel id="header-season-label">Mùa</InputLabel>
        <Select
          labelId="header-season-label"
          value={activeSeasonId || ""}
          label="Mùa"
          onChange={(event) => setActiveSeason(event.target.value)}
          sx={{
            bgcolor: "rgba(255,255,255,0.12)",
            color: "common.white",
            ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
            ".MuiSvgIcon-root": { color: "common.white" },
          }}
        >
          {seasons.map((season) => (
            <MenuItem key={season.id} value={season.id}>
              {season.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size={size} sx={{ minWidth: 160 }}>
        <InputLabel id="header-league-label">Giải</InputLabel>
        <Select
          labelId="header-league-label"
          value={activeLeagueId || ""}
          label="Giải"
          onChange={(event) => setActiveLeague(event.target.value)}
          sx={{
            bgcolor: "rgba(255,255,255,0.12)",
            color: "common.white",
            ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
            ".MuiSvgIcon-root": { color: "common.white" },
          }}
        >
          {leaguesForActiveSeason.map((league) => (
            <MenuItem key={league.id} value={league.id}>
              {league.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
