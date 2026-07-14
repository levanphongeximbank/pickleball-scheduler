import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  CLUB_MEMBER_ROLE_LABELS,
  CLUB_MEMBER_STATUSES,
  canViewFullClubMembers,
  getVicePresidentUserIds,
  listClubMembersAsync,
} from "../../../features/club/index.js";
import { ClubEmptyState, GovernanceRoleChip } from "../../../features/club/ui/index.js";
import { resolveMemberGovernanceRole } from "./myClubViewLogic.js";

function mapGovernanceChip(governanceRole) {
  if (!governanceRole) {
    return null;
  }
  if (governanceRole.includes("Phó")) {
    return { role: "vice", label: governanceRole };
  }
  if (governanceRole.includes("Chủ tịch") && governanceRole.includes("Chủ sở hữu")) {
    return { role: "president", label: governanceRole };
  }
  if (governanceRole === "Chủ tịch") {
    return { role: "president" };
  }
  if (governanceRole === "Chủ sở hữu") {
    return { role: "owner" };
  }
  return { role: "member", label: governanceRole };
}

function resolveGovernanceRoleFromV2(member, clubRecord) {
  const roles = member.governanceRoles || [];
  const hasPresident = roles.includes("president");
  const hasOwner = roles.includes("club_owner");
  const hasVice = roles.includes("vice_president");

  if (hasPresident && hasOwner) {
    return "Chủ sở hữu & Chủ tịch";
  }
  if (hasPresident) {
    return "Chủ tịch";
  }
  if (hasVice) {
    return "Phó chủ tịch";
  }
  if (hasOwner) {
    return "Chủ sở hữu";
  }

  const linkedUserId = member.userId || member.playerId;
  return resolveMemberGovernanceRole(linkedUserId, clubRecord?.governance, getVicePresidentUserIds);
}

function MemberRowContent({ row }) {
  const gov = mapGovernanceChip(row.governanceRole);
  return (
    <>
      <Typography fontWeight={600}>{row.name}</Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        {gov && <GovernanceRoleChip role={gov.role} label={gov.label} />}
        <GovernanceRoleChip role="member" label={row.memberRole} />
        <Chip
          size="small"
          label={row.isActive ? "Đang hoạt động" : "Không hoạt động"}
          color={row.isActive ? "success" : "default"}
          aria-label={row.isActive ? "Đang hoạt động" : "Không hoạt động"}
        />
      </Stack>
    </>
  );
}

export default function MyClubMembersPanel({
  clubId,
  tenantId,
  clubRecord,
  user,
  manageHref = null,
  revision = 0,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const fullAccess = clubRecord && user && canViewFullClubMembers(user, clubRecord);

  const canManage =
    fullAccess &&
    manageHref &&
    (!rbacEnabled ||
      !isAuthenticated ||
      can(PERMISSIONS.PLAYER_UPDATE, { clubId, venueId: tenantId }));

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!fullAccess || !clubId) {
      setMembers([]);
      setLoadError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setLoadError(null);

    void listClubMembersAsync(clubId, tenantId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setMembers([]);
        setLoadError(result.error || "Không tải được danh sách thành viên.");
        setLoading(false);
        return;
      }
      setMembers(result.members || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clubId, tenantId, revision, fullAccess]);

  const rows = useMemo(() => {
    if (!clubRecord) {
      return [];
    }

    return members
      .map((member) => {
        const name =
          String(member.displayName || "").trim() ||
          String(member.playerId || member.userId || "Thành viên").trim();

        return {
          id: member.id || member.userId || member.playerId,
          name,
          governanceRole: resolveGovernanceRoleFromV2(member, clubRecord),
          memberRole: CLUB_MEMBER_ROLE_LABELS[member.role] || member.role || "Thành viên",
          status: member.status,
          isActive: member.status === CLUB_MEMBER_STATUSES.ACTIVE,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [members, clubRecord]);

  const activeCount = rows.filter((row) => row.isActive).length;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700} component="h3">
            Thành viên CLB
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fullAccess
              ? `${activeCount} thành viên đang hoạt động`
              : "Bạn không có quyền xem danh sách chi tiết thành viên CLB này."}
          </Typography>
        </Box>
        {canManage && (
          <Button component={RouterLink} to={manageHref} variant="outlined" size="small">
            Quản lý thành viên
          </Button>
        )}
      </Stack>

      {!fullAccess && (
        <Alert severity="info">
          Theo quy tắc quyền riêng tư CLB, chỉ thành viên CLB và ban quản trị mới xem được danh sách
          đầy đủ. Chủ sân không tự động xem danh sách trừ khi là Chủ sở hữu CLB.
        </Alert>
      )}

      {fullAccess && loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {fullAccess && loading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {fullAccess && !loading && rows.length === 0 && !loadError && <ClubEmptyState preset="members" />}

      {fullAccess && !loading && rows.length > 0 && isMobile ? (
        <Stack spacing={1.5}>
          {rows.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <MemberRowContent row={row} />
            </Paper>
          ))}
        </Stack>
      ) : null}

      {fullAccess && !loading && rows.length > 0 && !isMobile ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Vai trò CLB</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const gov = mapGovernanceChip(row.governanceRole);
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{row.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {gov && <GovernanceRoleChip role={gov.role} label={gov.label} />}
                        <GovernanceRoleChip role="member" label={row.memberRole} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.isActive ? "Đang hoạt động" : "Không hoạt động"}
                        color={row.isActive ? "success" : "default"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );
}
