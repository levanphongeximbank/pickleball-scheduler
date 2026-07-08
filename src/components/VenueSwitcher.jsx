import { useMemo } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import { useAuth } from "../context/AuthContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { listVenues } from "../domain/venueService.js";
import { canAccessVenue } from "../auth/rbac.js";
import { loadActiveVenueId, saveActiveVenueId } from "../data/venueSession.js";
import { SHELL_COLORS } from "./shell/shellTokens.js";

const VARIANT_STYLES = {
  dark: {
    bgcolor: "rgba(255,255,255,0.12)",
    color: "common.white",
    outline: "rgba(255,255,255,0.3)",
    icon: "common.white",
  },
  light: {
    bgcolor: SHELL_COLORS.pageBg,
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

export default function VenueSwitcher({ size = "small", minWidth = 180, variant = "dark", hideLabel = false }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const { currentTenantId } = useTenant();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  const venues = useMemo(() => {
    const all = listVenues();
    if (!rbacEnabled || !isAuthenticated || !user) {
      return all;
    }
    return all.filter((venue) => canAccessVenue(user, venue.id, { rbacEnabled }));
  }, [rbacEnabled, isAuthenticated, user, currentTenantId]);

  if (venues.length <= 1 && !user?.venueId) {
    return null;
  }

  const storedId = loadActiveVenueId();
  const defaultId = user?.venueId || venues[0]?.id || "";
  const value = venues.some((v) => v.id === storedId) ? storedId : defaultId;

  const handleChange = (event) => {
    saveActiveVenueId(event.target.value);
    window.dispatchEvent(new CustomEvent("venue-switched", { detail: event.target.value }));
  };

  const fieldLabel = hideLabel ? "" : "Tổ chức";

  return (
    <FormControl size={size} sx={{ minWidth, width: hideLabel ? "100%" : undefined }}>
      {!hideLabel && (
        <InputLabel id="header-venue-label" sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}>
          Tổ chức
        </InputLabel>
      )}
      <Select
        labelId="header-venue-label"
        value={value}
        label={fieldLabel}
        onChange={handleChange}
        displayEmpty={hideLabel}
        sx={{
          bgcolor: styles.bgcolor,
          color: styles.color,
          borderRadius: variant === "light" ? 2 : 1,
          fontWeight: variant === "light" ? 700 : 500,
          fontSize: hideLabel ? 11.5 : undefined,
          ...(hideLabel && {
            height: 30,
            "& .MuiSelect-select": { py: 0.5 },
          }),
          ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
          ".MuiSvgIcon-root": { color: styles.icon },
        }}
      >
        {venues.map((venue) => (
          <MenuItem key={venue.id} value={venue.id}>
            {venue.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
