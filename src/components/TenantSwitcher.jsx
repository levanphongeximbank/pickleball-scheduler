import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";

import { useTenant } from "../context/TenantContext.jsx";
import { listTenants } from "../features/tenant/index.js";

export default function TenantSwitcher({ size = "small", minWidth = 200 }) {
  const { currentTenantId, isSuperAdmin, switchTenant } = useTenant();

  if (!isSuperAdmin) {
    return null;
  }

  const tenants = listTenants();
  const value = tenants.some((tenant) => tenant.id === currentTenantId)
    ? currentTenantId
    : tenants[0]?.id || "";

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel id="header-tenant-label">Đang quản trị</InputLabel>
      <Select
        labelId="header-tenant-label"
        value={value}
        label="Đang quản trị"
        onChange={(event) => switchTenant(event.target.value)}
        sx={{
          bgcolor: "rgba(255,255,255,0.12)",
          color: "common.white",
          ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
          ".MuiSvgIcon-root": { color: "common.white" },
        }}
      >
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
