import { FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
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

export default function ClubSwitcher({ size = "small", minWidth = 140, variant = "dark" }) {
  const { clubs, activeClubId, switchClub } = useClub();
  const { rbacEnabled, isAuthenticated, canAccessClub } = useAuth();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  const visibleClubs =
    rbacEnabled && isAuthenticated
      ? clubs.filter((club) => canAccessClub(club.id, { venueId: club.venueId || null }))
      : clubs;

  if (rbacEnabled && isAuthenticated && visibleClubs.length === 0) {
    return null;
  }

  const value = visibleClubs.some((club) => club.id === activeClubId)
    ? activeClubId
    : visibleClubs[0]?.id || activeClubId;

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel id="header-club-label" sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}>
        CLB
      </InputLabel>
      <Select
        labelId="header-club-label"
        value={value}
        label="CLB"
        onChange={(event) => switchClub(event.target.value)}
        sx={{
          bgcolor: styles.bgcolor,
          color: styles.color,
          borderRadius: 1.5,
          ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
          ".MuiSvgIcon-root": { color: styles.icon },
        }}
      >
        {visibleClubs.map((club) => (
          <MenuItem key={club.id} value={club.id}>
            {club.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function ClubSwitcherRow() {
  return (
    <Stack direction="row" spacing={1} sx={{ ml: "auto", alignItems: "center" }}>
      <ClubSwitcher />
    </Stack>
  );
}
