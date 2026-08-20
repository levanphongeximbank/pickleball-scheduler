import { FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { SHELL_COLORS } from "./shell/shellTokens.js";
import { CLUB_READ_STATE } from "../features/club/context/clubCanonicalReadModel.js";

const VARIANT_STYLES = {
  dark: {
    bgcolor: "rgba(255,255,255,0.12)",
    color: "common.white",
    outline: "rgba(255,255,255,0.3)",
    icon: "common.white",
  },
  light: {
    bgcolor: "#FFFFFF",
    color: SHELL_COLORS.textPrimary,
    outline: SHELL_COLORS.border,
    icon: SHELL_COLORS.textSecondary,
  },
  context: {
    bgcolor: "#FFFFFF",
    color: SHELL_COLORS.textPrimary,
    outline: SHELL_COLORS.border,
    icon: SHELL_COLORS.textSecondary,
  },
};

/**
 * Shared Club selection control (desktop + mobile parity).
 * Never fakes the first club as the active selection when none is selected.
 */
export default function ClubSwitcher({
  size = "small",
  minWidth = 140,
  variant = "dark",
  forceVisible = false,
}) {
  const { clubs, activeClubId, switchClub, canonicalClubRead, clubReadState, activeClubReady } =
    useClub();
  const { rbacEnabled, isAuthenticated, canAccessClub } = useAuth();
  const { currentTenantId } = useTenant();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  // Phase 45A.1 — in canonical cloud read mode the switcher renders explicit
  // loading/error states and never falls back to a stale local-only club list.
  if (canonicalClubRead && clubReadState === CLUB_READ_STATE.LOADING) {
    return (
      <FormControl size={size} sx={{ minWidth }} disabled data-testid="club-switcher-loading">
        <InputLabel
          id="header-club-label"
          shrink
          sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}
        >
          CLB
        </InputLabel>
        <Select
          labelId="header-club-label"
          value=""
          label="CLB"
          displayEmpty
          notched
          renderValue={() => "Đang tải…"}
          sx={{
            bgcolor: styles.bgcolor,
            color: styles.color,
            borderRadius: 1.5,
            ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
            ".MuiSvgIcon-root": { color: styles.icon },
          }}
        >
          <MenuItem value="">
            <em>Đang tải…</em>
          </MenuItem>
        </Select>
      </FormControl>
    );
  }

  if (canonicalClubRead && clubReadState === CLUB_READ_STATE.ERROR) {
    return null;
  }

  const visibleClubs =
    rbacEnabled && isAuthenticated
      ? clubs.filter((club) => canAccessClub(club.id, { venueId: club.venueId || null }))
      : clubs;

  const needsSelection =
    Boolean(currentTenantId) &&
    (visibleClubs.length > 1 || (visibleClubs.length >= 1 && !activeClubReady));

  if (!forceVisible && rbacEnabled && isAuthenticated && visibleClubs.length === 0) {
    return null;
  }

  if (!forceVisible && rbacEnabled && isAuthenticated && !needsSelection && visibleClubs.length <= 1) {
    // Unique auto-selected club: still show so desktop/mobile can confirm selection.
    if (visibleClubs.length === 1 && activeClubReady) {
      // keep visible for parity
    } else if (visibleClubs.length === 0) {
      return null;
    }
  }

  const hasActive = visibleClubs.some((club) => club.id === activeClubId);
  // Wave 1: never display first club as if it were selected when preference is unset/stale.
  const value = hasActive ? activeClubId : "";

  return (
    <FormControl
      size={size}
      sx={{ minWidth }}
      data-testid="club-switcher"
      data-club-required={!hasActive && visibleClubs.length > 0 ? "true" : "false"}
    >
      <InputLabel
        id="header-club-label"
        shrink
        sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}
      >
        CLB
      </InputLabel>
      <Select
        labelId="header-club-label"
        value={value}
        label="CLB"
        displayEmpty
        notched
        renderValue={(selected) => {
          if (!selected) {
            return visibleClubs.length > 1 ? "Chọn CLB…" : "Chưa chọn CLB";
          }
          const club = visibleClubs.find((item) => item.id === selected);
          return club?.name || selected;
        }}
        onChange={(event) => switchClub(event.target.value)}
        sx={{
          bgcolor: styles.bgcolor,
          color: styles.color,
          borderRadius: 1.5,
          ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
          ".MuiSvgIcon-root": { color: styles.icon },
        }}
      >
        {!hasActive ? (
          <MenuItem value="">
            <em>{visibleClubs.length > 1 ? "Chọn CLB…" : "Chưa chọn CLB"}</em>
          </MenuItem>
        ) : null}
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
