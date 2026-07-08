import { FormControl, MenuItem, Select, Typography } from "@mui/material";

import { useCluster } from "../../context/ClusterContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canAccessCluster } from "../../auth/rbac.js";
import { SHELL_COLORS } from "./shellTokens.js";

export default function CurrentFacilitySwitcher({ size = "small" }) {
  const { clusters, activeClusterId, activeCluster, switchCluster } = useCluster();
  const { user, rbacEnabled, isAuthenticated } = useAuth();

  const visibleClusters =
    rbacEnabled && isAuthenticated
      ? clusters.filter((cluster) =>
          canAccessCluster(user, cluster.id, { venueId: cluster.venueId }, { rbacEnabled })
        )
      : clusters;

  if (visibleClusters.length === 0) {
    return (
      <Typography
        variant="caption"
        sx={{ color: SHELL_COLORS.sidebarTextMuted, fontSize: 11.5, display: "block", py: 0.5 }}
      >
        Chưa có cụm sân
      </Typography>
    );
  }

  const value = visibleClusters.some((cluster) => cluster.id === activeClusterId)
    ? activeClusterId
    : visibleClusters[0]?.id || "";

  const selectedCluster =
    visibleClusters.find((cluster) => cluster.id === value) || activeCluster || visibleClusters[0];

  if (visibleClusters.length === 1) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: SHELL_COLORS.sidebarText,
          fontWeight: 600,
          fontSize: 11.5,
          py: 0.5,
          px: 0.25,
        }}
        noWrap
        title={selectedCluster?.address || selectedCluster?.name}
      >
        {selectedCluster?.name || "Cụm sân"}
      </Typography>
    );
  }

  return (
    <FormControl size={size} sx={{ width: "100%" }}>
      <Select
        value={value || ""}
        onChange={(event) => switchCluster(event.target.value)}
        displayEmpty
        sx={{
          bgcolor: "rgba(255,255,255,0.12)",
          color: "common.white",
          borderRadius: 1,
          fontWeight: 500,
          fontSize: 11.5,
          height: 30,
          "& .MuiSelect-select": { py: 0.5 },
          ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
          ".MuiSvgIcon-root": { color: "common.white" },
        }}
      >
        {visibleClusters.map((cluster) => (
          <MenuItem key={cluster.id} value={cluster.id}>
            {cluster.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
