import { FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";

import { useSeasonLeague } from "../context/SeasonContext.jsx";
import { SHELL_COLORS } from "./shell/shellTokens.js";

const VARIANT_STYLES = {
  dark: {
    bgcolor: "rgba(255,255,255,0.12)",
    color: "common.white",
    outline: "rgba(255,255,255,0.3)",
    icon: "common.white",
  },
  context: {
    bgcolor: "#FFFFFF",
    color: SHELL_COLORS.textPrimary,
    outline: SHELL_COLORS.border,
    icon: SHELL_COLORS.textSecondary,
  },
};

export default function SeasonLeagueSwitcher({ size = "small", variant = "dark" }) {
  const {
    seasons,
    leaguesForActiveSeason,
    activeSeasonId,
    activeLeagueId,
    setActiveSeason,
    setActiveLeague,
  } = useSeasonLeague();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  return (
    <Stack direction="row" spacing={1}>
      <FormControl size={size} sx={{ minWidth: 120 }}>
        <InputLabel id="header-season-label" sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}>
          Mùa
        </InputLabel>
        <Select
          labelId="header-season-label"
          value={activeSeasonId || ""}
          label="Mùa"
          onChange={(event) => setActiveSeason(event.target.value)}
          sx={{
            bgcolor: styles.bgcolor,
            color: styles.color,
            borderRadius: 1.5,
            ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
            ".MuiSvgIcon-root": { color: styles.icon },
          }}
        >
          {seasons.map((season) => (
            <MenuItem key={season.id} value={season.id}>
              {season.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size={size} sx={{ minWidth: 140 }}>
        <InputLabel id="header-league-label" sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}>
          Giải
        </InputLabel>
        <Select
          labelId="header-league-label"
          value={activeLeagueId || ""}
          label="Giải"
          onChange={(event) => setActiveLeague(event.target.value)}
          sx={{
            bgcolor: styles.bgcolor,
            color: styles.color,
            borderRadius: 1.5,
            ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
            ".MuiSvgIcon-root": { color: styles.icon },
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
