import { FormControl, InputLabel, MenuItem, Select, Stack, Typography, IconButton, Tooltip } from "@mui/material";
import DirectionsIcon from "@mui/icons-material/Directions";

import { useCluster } from "../context/ClusterContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { canAccessCluster } from "../auth/rbac.js";
import { openClusterInGoogleMaps } from "../features/court-cluster/utils/clusterMapsUtils.js";
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

export default function ClusterSwitcher({ size = "small", minWidth = 160, variant = "dark" }) {
  const { clusters, activeClusterId, activeCluster, switchCluster, clustersEnabled } = useCluster();
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.dark;

  if (!clustersEnabled || clusters.length <= 1) {
    return null;
  }

  const visibleClusters =
    rbacEnabled && isAuthenticated
      ? clusters.filter((cluster) =>
          canAccessCluster(user, cluster.id, { venueId: cluster.venueId }, { rbacEnabled })
        )
      : clusters;

  if (visibleClusters.length === 0) {
    return null;
  }

  const value = visibleClusters.some((cluster) => cluster.id === activeClusterId)
    ? activeClusterId
    : visibleClusters[0]?.id || activeClusterId;

  const selectedCluster =
    visibleClusters.find((cluster) => cluster.id === value) || activeCluster || null;

  return (
    <Stack spacing={0.25} alignItems="flex-end">
      <Stack direction="row" spacing={0.5} alignItems="center">
        <FormControl size={size} sx={{ minWidth }}>
          <InputLabel
            id="header-cluster-label"
            sx={variant !== "dark" ? { color: SHELL_COLORS.textSecondary } : undefined}
          >
            Cụm sân
          </InputLabel>
          <Select
            labelId="header-cluster-label"
            value={value || ""}
            label="Cụm sân"
            onChange={(event) => switchCluster(event.target.value)}
            sx={{
              bgcolor: styles.bgcolor,
              color: styles.color,
              borderRadius: 1.5,
              ".MuiOutlinedInput-notchedOutline": { borderColor: styles.outline },
              ".MuiSvgIcon-root": { color: styles.icon },
            }}
          >
            {visibleClusters.map((cluster) => (
              <MenuItem key={cluster.id} value={cluster.id}>
                {cluster.name} ({cluster.courtCount || 0})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedCluster?.googleMapsUrl && (
          <Tooltip title="Chỉ đường Google Maps">
            <IconButton
              size="small"
              onClick={() => openClusterInGoogleMaps(selectedCluster)}
              sx={{ color: variant === "dark" ? "common.white" : SHELL_COLORS.textSecondary }}
            >
              <DirectionsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {selectedCluster?.address && (
        <Typography
          variant="caption"
          sx={{
            color: variant === "dark" ? "rgba(255,255,255,0.75)" : SHELL_COLORS.textSecondary,
            maxWidth: minWidth + 40,
            textAlign: "right",
          }}
          noWrap
          title={selectedCluster.address}
        >
          {selectedCluster.address}
        </Typography>
      )}
    </Stack>
  );
}

export function ClusterSwitcherRow() {
  return (
    <Stack direction="row" spacing={1} sx={{ ml: "auto", alignItems: "center" }}>
      <ClusterSwitcher />
    </Stack>
  );
}
