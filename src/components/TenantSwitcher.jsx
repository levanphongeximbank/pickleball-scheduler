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

export default function TenantSwitcher({
  size = "small",
  minWidth = 180,
  maxWidth,
  variant = "dark",
}) {
  const { currentTenantId, isSuperAdmin, switchTenant, revision } = useTenant();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;
  const tenants = useMemo(() => listTenants(), [revision]);

  if (!isSuperAdmin) {
    return null;
  }

  const hasSelection = tenants.some((tenant) => tenant.id === currentTenantId);
  const value = hasSelection ? currentTenantId : "";
  const selectedLabel = value
    ? tenants.find((item) => item.id === value)?.name || value
    : "Chọn tổ chức…";

  return (
    <FormControl
      size={size}
      fullWidth={Boolean(maxWidth)}
      data-testid="canonical-organization-switcher"
      sx={{
        minWidth: 0,
        width: maxWidth ? "100%" : undefined,
        maxWidth: maxWidth || undefined,
        ...(maxWidth ? null : { minWidth }),
      }}
    >
      <InputLabel
        id="header-tenant-label"
        sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}
      >
        Đang quản trị
      </InputLabel>
      <Select
        labelId="header-tenant-label"
        value={value}
        label="Đang quản trị"
        displayEmpty
        renderValue={() => (
          <Typography
            component="span"
            title={selectedLabel}
            sx={{
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "inherit",
              lineHeight: 1.4,
            }}
          >
            {selectedLabel}
          </Typography>
        )}
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
          maxWidth: "100%",
          ".MuiSelect-select": {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            pr: "32px !important",
          },
          ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
          ".MuiSvgIcon-root": { color: styles.icon },
        }}
      >
        <MenuItem value="" disabled>
          <em>Chọn tổ chức…</em>
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
