import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useMemo } from "react";

import { useTenant } from "../context/TenantContext.jsx";
import { listTenants } from "../features/tenant/index.js";
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

export default function TenantSwitcher({ size = "small", minWidth = 180, variant = "dark" }) {
  const { currentTenantId, isSuperAdmin, switchTenant, revision } = useTenant();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  if (!isSuperAdmin) {
    return null;
  }

  const tenants = useMemo(() => listTenants(), [revision]);
  const hasSelection = tenants.some((tenant) => tenant.id === currentTenantId);
  const value = hasSelection ? currentTenantId : "";

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel id="header-tenant-label" sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}>
        Đang quản trị
      </InputLabel>
      <Select
        labelId="header-tenant-label"
        value={value}
        label="Đang quản trị"
        displayEmpty
        renderValue={(selected) => {
          if (!selected) {
            return "Chọn tenant…";
          }
          const tenant = tenants.find((item) => item.id === selected);
          return tenant?.name || selected;
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (next) {
            switchTenant(next);
          }
        }}
        sx={{
          bgcolor: styles.bgcolor,
          color: styles.color,
          borderRadius: 1.5,
          ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
          ".MuiSvgIcon-root": { color: styles.icon },
        }}
      >
        <MenuItem value="" disabled>
          <em>Chọn tenant…</em>
        </MenuItem>
        {tenants.map((tenant) => (
          <MenuItem key={tenant.id} value={tenant.id}>
            {tenant.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function TenantBadge() {
  const { currentTenant, isSuperAdmin } = useTenant();

  if (!currentTenant) {
    return null;
  }

  return (
    <Typography
      variant="caption"
      sx={{
        color: "rgba(255,255,255,0.85)",
        fontWeight: 700,
        display: { xs: "none", md: "block" },
      }}
    >
      {isSuperAdmin ? "Đang quản trị: " : "Sân: "}
      {currentTenant.name}
    </Typography>
  );
}
