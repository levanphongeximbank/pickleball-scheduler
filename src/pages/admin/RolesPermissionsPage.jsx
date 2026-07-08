import { useCallback, useEffect, useMemo, useState } from "react";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { SHELL_COLORS } from "../../components/shell/shellTokens.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLE_LABELS } from "../../auth/roles.js";
import { getPermissionLabel } from "../../features/identity/constants/permissionsConfig.js";
import {
  canEditRoleForUser,
  getDefaultPermissionsSet,
  getPermissionUiState,
  getUiGroupsForRole,
  hasTenantOverrides,
  isRolePlatformReadOnly,
  listRolesForPermissionUi,
} from "../../features/identity/constants/rolePermissionUiConfig.js";
import {
  clearTenantRoleOverrides,
  getEffectivePermissionsForTenantRole,
  getTenantRoleOverrides,
  saveTenantRoleOverrides,
} from "../../features/identity/services/tenantRolePermissionService.js";
import { listUsers } from "../../features/identity/services/userManagementService.js";

function setsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

function PermissionStateBadge({ state }) {
  if (state === "added") {
    return (
      <Chip
        size="small"
        label="+Thêm"
        sx={{
          ml: 1,
          height: 20,
          fontSize: 11,
          bgcolor: SHELL_COLORS.mintBg,
          color: SHELL_COLORS.primaryGreen,
          borderColor: SHELL_COLORS.primaryGreen,
        }}
        variant="outlined"
      />
    );
  }

  if (state === "removed") {
    return (
      <Chip
        size="small"
        label="-Bớt"
        sx={{
          ml: 1,
          height: 20,
          fontSize: 11,
          bgcolor: "#FFFBEB",
          color: "#D97706",
          borderColor: "#F59E0B",
        }}
        variant="outlined"
      />
    );
  }

  return null;
}

export default function RolesPermissionsPage() {
  const { user, can } = useAuth();
  const { currentTenant, currentTenantId } = useTenant();

  const tenantId = currentTenantId || "default";
  const tenantLabel = currentTenant?.name || "Default Tenant";

  const roles = useMemo(() => listRolesForPermissionUi(user?.role), [user?.role]);
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState(roles[0] || "");
  const [roleCounts, setRoleCounts] = useState({});
  const [draftEffective, setDraftEffective] = useState(() => new Set());
  const [savedEffective, setSavedEffective] = useState(() => new Set());
  const [message, setMessage] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const canManage =
    can(PERMISSIONS.ROLE_MANAGE) || can(PERMISSIONS.TENANT_ROLE_CUSTOMIZE);
  const canEditSelected = canEditRoleForUser(user?.role, selectedRole) && canManage;
  const readOnlyRole = isRolePlatformReadOnly(selectedRole);

  const defaultSet = useMemo(
    () => getDefaultPermissionsSet(selectedRole),
    [selectedRole]
  );

  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) {
      return roles;
    }
    return roles.filter((role) => {
      const label = (ROLE_LABELS[role] || role).toLowerCase();
      return label.includes(query) || role.toLowerCase().includes(query);
    });
  }, [roleSearch, roles]);

  const uiGroups = useMemo(() => getUiGroupsForRole(selectedRole), [selectedRole]);

  const dirty = useMemo(
    () => !setsEqual(draftEffective, savedEffective),
    [draftEffective, savedEffective]
  );

  const loadRoleState = useCallback(
    (role) => {
      const effective = getEffectivePermissionsForTenantRole(tenantId, role);
      setDraftEffective(new Set(effective));
      setSavedEffective(new Set(effective));
    },
    [tenantId]
  );

  useEffect(() => {
    if (roles.length > 0 && (!selectedRole || !roles.includes(selectedRole))) {
      setSelectedRole(roles[0]);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    if (selectedRole) {
      loadRoleState(selectedRole);
    }
  }, [selectedRole, tenantId, loadRoleState]);

  useEffect(() => {
    if (!can(PERMISSIONS.USER_VIEW) && !can(PERMISSIONS.USER_MANAGE)) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const result = await listUsers();
      if (!result.ok || cancelled) {
        return;
      }

      const counts = {};
      result.users.forEach((entry) => {
        counts[entry.role] = (counts[entry.role] || 0) + 1;
      });
      setRoleCounts(counts);
    })();

    return () => {
      cancelled = true;
    };
  }, [can]);

  const handleTogglePermission = (permission) => {
    if (!canEditSelected) {
      return;
    }

    setDraftEffective((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!canEditSelected) {
      return;
    }

    const result = saveTenantRoleOverrides(tenantId, selectedRole, draftEffective);
    if (!result.ok) {
      setMessage({ type: "error", text: "Không lưu được thay đổi." });
      return;
    }

    setSavedEffective(new Set(draftEffective));
    setMessage({ type: "success", text: "Đã lưu quyền cho chức danh." });
  };

  const handleReset = () => {
    if (!canEditSelected) {
      return;
    }

    clearTenantRoleOverrides(tenantId, selectedRole);
    loadRoleState(selectedRole);
    setResetDialogOpen(false);
    setMessage({ type: "success", text: "Đã khôi phục quyền mặc định." });
  };

  const roleHasCustomOverrides = hasTenantOverrides(
    getTenantRoleOverrides(tenantId, selectedRole)
  );

  return (
    <PermissionGate
      permissions={[
        PERMISSIONS.ROLE_VIEW,
        PERMISSIONS.PERMISSION_VIEW,
        PERMISSIONS.ROLE_MANAGE,
        PERMISSIONS.TENANT_ROLE_CUSTOMIZE,
      ]}
      fallback={
        <Alert severity="error">Bạn không có quyền xem vai trò và quyền.</Alert>
      }
    >
      <Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={800} color={SHELL_COLORS.textPrimary}>
              Vai trò & Quyền
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Cấu hình quyền theo chức danh cho cơ sở hiện tại
            </Typography>
          </Box>
          <Chip
            label={`Cơ sở: ${tenantLabel}`}
            sx={{
              bgcolor: SHELL_COLORS.mintBg,
              color: SHELL_COLORS.primaryGreen,
              borderColor: SHELL_COLORS.primaryGreen,
              fontWeight: 600,
            }}
            variant="outlined"
          />
        </Stack>

        {dirty && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setDraftEffective(new Set(savedEffective))}
                >
                  Hủy
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSave}
                  disabled={!canEditSelected}
                >
                  Lưu thay đổi
                </Button>
              </Stack>
            }
          >
            Bạn có thay đổi chưa lưu
          </Alert>
        )}

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
          <Card sx={{ width: { xs: "100%", lg: 320 }, flexShrink: 0 }}>
            <CardContent>
              <TextField
                size="small"
                fullWidth
                placeholder="Tìm chức danh..."
                value={roleSearch}
                onChange={(event) => setRoleSearch(event.target.value)}
                sx={{ mb: 2 }}
              />
              <Stack spacing={1}>
                {filteredRoles.map((role) => {
                  const selected = role === selectedRole;
                  const locked = isRolePlatformReadOnly(role);
                  const customized = hasTenantOverrides(getTenantRoleOverrides(tenantId, role));
                  const count = roleCounts[role];

                  return (
                    <Box
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 1.5,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: selected ? SHELL_COLORS.primaryGreen : SHELL_COLORS.border,
                        bgcolor: selected ? "rgba(16, 185, 129, 0.08)" : "transparent",
                        borderLeftWidth: selected ? 4 : 1,
                        "&:hover": {
                          bgcolor: selected
                            ? "rgba(16, 185, 129, 0.12)"
                            : "rgba(15, 23, 42, 0.03)",
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0, pr: 1 }}>
                          <Typography variant="body2" fontWeight={selected ? 700 : 600} noWrap>
                            {ROLE_LABELS[role] || role}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                            {typeof count === "number" && (
                              <Typography variant="caption" color="text.secondary">
                                {count} người
                              </Typography>
                            )}
                            {customized && (
                              <Chip
                                size="small"
                                label="Có tùy chỉnh"
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            )}
                            {locked && (
                              <Stack direction="row" spacing={0.25} alignItems="center">
                                <LockOutlinedIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                                <Typography variant="caption" color="text.secondary">
                                  Chỉ xem
                                </Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={2}
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {ROLE_LABELS[selectedRole] || selectedRole}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {readOnlyRole
                      ? "Ma trận mặc định hệ thống — không chỉnh tại cấp cơ sở."
                      : "Gợi ý mặc định hệ thống — bạn có thể thêm hoặc bớt quyền cho cơ sở này."}
                  </Typography>
                  {roleHasCustomOverrides && (
                    <Chip
                      size="small"
                      label="Đang có tùy chỉnh theo cơ sở"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() => setResetDialogOpen(true)}
                    disabled={!canEditSelected || !roleHasCustomOverrides}
                  >
                    Khôi phục mặc định
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!canEditSelected || !dirty}
                  >
                    Lưu thay đổi
                  </Button>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Chip size="small" label="Mặc định" variant="outlined" />
                <Chip
                  size="small"
                  label="+Thêm"
                  variant="outlined"
                  sx={{ color: SHELL_COLORS.primaryGreen, borderColor: SHELL_COLORS.primaryGreen }}
                />
                <Chip
                  size="small"
                  label="-Bớt"
                  variant="outlined"
                  sx={{ color: "#D97706", borderColor: "#F59E0B" }}
                />
              </Stack>

              {uiGroups.map((group, index) => (
                <Accordion
                  key={group.id}
                  defaultExpanded={index === 0}
                  disableGutters
                  sx={{
                    mb: 1,
                    border: `1px solid ${SHELL_COLORS.border}`,
                    borderRadius: "8px !important",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600}>{group.label}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={0.5}>
                      {group.permissions.map((permission) => {
                        const state = getPermissionUiState(
                          permission,
                          defaultSet,
                          draftEffective
                        );
                        const checked = state === "default" || state === "added";
                        const label = getPermissionLabel(permission);

                        return (
                          <FormControlLabel
                            key={permission}
                            control={
                              <Checkbox
                                checked={checked}
                                disabled={!canEditSelected}
                                onChange={() => handleTogglePermission(permission)}
                                sx={{
                                  color: SHELL_COLORS.border,
                                  "&.Mui-checked": { color: SHELL_COLORS.primaryGreen },
                                }}
                              />
                            }
                            label={
                              <Stack direction="row" alignItems="center" flexWrap="wrap">
                                <Typography
                                  variant="body2"
                                  sx={{
                                    textDecoration:
                                      state === "removed" ? "line-through" : "none",
                                    color:
                                      state === "removed"
                                        ? "text.secondary"
                                        : SHELL_COLORS.textPrimary,
                                  }}
                                >
                                  {label}
                                </Typography>
                                {state === "added" ? (
                                  <Tooltip title="Quyền không có trong gợi ý chức danh — do chủ sân thêm">
                                    <span>
                                      <PermissionStateBadge state={state} />
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <PermissionStateBadge state={state} />
                                )}
                              </Stack>
                            }
                          />
                        );
                      })}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                Thay đổi áp dụng cho cơ sở <strong>{tenantLabel}</strong> — không ảnh hưởng
                chức danh toàn hệ thống.
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
          <DialogTitle>Khôi phục quyền mặc định?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Khôi phục quyền mặc định cho{" "}
              <strong>{ROLE_LABELS[selectedRole] || selectedRole}</strong> tại cơ sở{" "}
              <strong>{tenantLabel}</strong>? Các tùy chỉnh thêm/bớt sẽ bị xóa.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetDialogOpen(false)}>Hủy</Button>
            <Button variant="contained" onClick={handleReset}>
              Khôi phục
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
}
