import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";

import { useTenant } from "../context/TenantContext.jsx";
import { resolveTenantSwitcherView } from "../features/tenant/services/tenantSelectionModel.js";
import { SHELL_COLORS } from "./shell/shellTokens.js";

const LIGHT_STYLES = {
  bgcolor: "#FFFFFF",
  color: SHELL_COLORS.textPrimary,
  outline: SHELL_COLORS.border,
  icon: SHELL_COLORS.textSecondary,
};

const VARIANT_STYLES = {
  dark: {
    bgcolor: "rgba(255,255,255,0.12)",
    color: "common.white",
    outline: "rgba(255,255,255,0.3)",
    icon: "common.white",
  },
  // Header + CanonicalTopBar both use light surfaces — never fall back to dark/white text.
  light: LIGHT_STYLES,
  context: LIGHT_STYLES,
};

export default function TenantSwitcher({
  size = "small",
  minWidth = 180,
  maxWidth,
  variant = "dark",
}) {
  const {
    currentTenantId,
    currentTenant,
    isSuperAdmin,
    switchTenant,
    tenants: contextTenants,
  } = useTenant();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;
  const tenants = contextTenants || [];

  if (!isSuperAdmin) {
    return null;
  }

  const { value, selectedLabel, displayTenant } = resolveTenantSwitcherView({
    currentTenantId,
    tenants,
    currentTenant,
  });

  const catalogHasValue = Boolean(value) && tenants.some((tenant) => tenant.id === value);
  const orphanDisplay =
    value && !catalogHasValue && displayTenant
      ? displayTenant
      : value && !catalogHasValue
        ? { id: value, name: selectedLabel }
        : null;

  return (
    <FormControl
      size={size}
      fullWidth={Boolean(maxWidth)}
      data-testid="canonical-organization-switcher"
      data-selected-tenant-id={value || ""}
      data-selected-tenant-label={selectedLabel}
      sx={{
        minWidth: maxWidth ? Math.min(minWidth, maxWidth) : minWidth,
        width: maxWidth ? "100%" : undefined,
        maxWidth: maxWidth || undefined,
      }}
    >
      <InputLabel
        id="header-tenant-label"
        shrink
        sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}
      >
        Đang quản trị
      </InputLabel>
      <Select
        labelId="header-tenant-label"
        value={value}
        label="Đang quản trị"
        displayEmpty
        notched
        renderValue={() => (
          <Typography
            component="span"
            title={selectedLabel}
            data-testid="tenant-switcher-selected-label"
            sx={{
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "inherit",
              lineHeight: 1.4,
              color: "inherit",
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
        {orphanDisplay ? (
          <MenuItem key={orphanDisplay.id} value={orphanDisplay.id}>
            {orphanDisplay.name || orphanDisplay.id}
          </MenuItem>
        ) : null}
        {tenants.map((tenant) => (
          <MenuItem key={tenant.id} value={tenant.id}>
            {tenant.name || tenant.id}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function TenantBadge() {
  const { currentTenant, currentTenantId, isSuperAdmin } = useTenant();
  const label = String(currentTenant?.name || "").trim() || currentTenantId;

  if (!label) {
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
      {label}
    </Typography>
  );
}
