import { useMemo } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import { useAuth } from "../context/AuthContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useVenue } from "../context/VenueContext.jsx";
import { canAccessVenue } from "../auth/rbac.js";
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

/**
 * Wave 3 — Venue selector (physical facility). Scoped by selected Tenant.
 * Label is Venue/Cơ sở — not Organization.
 */
export default function VenueSwitcher({
  size = "small",
  minWidth = 180,
  variant = "dark",
  hideLabel = false,
}) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const { currentTenantId } = useTenant();
  const { venues, currentVenueId, switchVenue } = useVenue();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  const scopedVenues = useMemo(() => {
    if (!currentTenantId) {
      return [];
    }
    if (!rbacEnabled || !isAuthenticated || !user) {
      return venues;
    }
    return venues.filter((venue) => canAccessVenue(user, venue.id, { rbacEnabled }));
  }, [venues, currentTenantId, rbacEnabled, isAuthenticated, user]);

  if (!currentTenantId) {
    return null;
  }

  if (scopedVenues.length === 0) {
    return null;
  }

  // Hide when exactly one venue and it is already selected (deterministic 1-option UX).
  if (scopedVenues.length === 1 && currentVenueId === scopedVenues[0].id) {
    return null;
  }

  const value = scopedVenues.some((v) => v.id === currentVenueId)
    ? currentVenueId
    : "";

  const handleChange = (event) => {
    switchVenue(event.target.value);
  };

  const fieldLabel = hideLabel ? "" : "Cơ sở";

  return (
    <FormControl size={size} sx={{ minWidth, width: hideLabel ? "100%" : undefined }}>
      {!hideLabel && (
        <InputLabel
          id="header-venue-label"
          sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}
        >
          Cơ sở
        </InputLabel>
      )}
      <Select
        labelId="header-venue-label"
        data-testid="canonical-venue-switcher"
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
        {value === "" && (
          <MenuItem value="" disabled>
            Chọn cơ sở…
          </MenuItem>
        )}
        {scopedVenues.map((venue) => (
          <MenuItem key={venue.id} value={venue.id}>
            {venue.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
