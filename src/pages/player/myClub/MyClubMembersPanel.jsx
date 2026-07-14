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
  getClubMembers,
  getTenantPlayers,
  getVicePresidentUserIds,
  rpcV2ClubListMembers,
} from "../../../features/club/index.js";
import { isClubStorageV2Enabled } from "../../../features/club/config/clubRegistryFlags.js";
import { ClubEmptyState, GovernanceRoleChip } from "../../../features/club/ui/index.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { findUserIdByPlayerId } from "../../../features/club/storage/athleteClubLinkStore.js";
import {
  buildMemberRowsFromV2Members,
  resolveMemberGovernanceRole,
} from "./myClubViewLogic.js";

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

  const v2Enabled = isClubStorageV2Enabled();

  // Phase 42N: the member list is server-owned (Supabase club_members). Legacy
  // local-storage rosters are empty in production, which previously made this
  // panel show 0 while the home card (V2 RPC) showed the real count.
  const [v2, setV2] = useState({ status: "idle", members: [], error: null });

  useEffect(() => {
    if (!v2Enabled || !fullAccess || !clubId) {
      setV2({ status: "idle", members: [], error: null });
      return undefined;
    }
    let cancelled = false;
    setV2((prev) => ({ ...prev, status: "loading" }));
    rpcV2ClubListMembers(clubId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setV2({ status: "ready", members: result.members || [], error: null });
        } else {
          setV2({ status: "error", members: [], error: result.error || result.code || "RPC_FAILED" });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setV2({ status: "error", members: [], error: String(error?.message || error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [v2Enabled, fullAccess, clubId, revision]);

  const members = useMemo(() => {
    void revision;
    if (!fullAccess || !clubId) {
      return [];
    }
    return getClubMembers(clubId, tenantId);
  }, [clubId, tenantId, revision, fullAccess]);

  const playersById = useMemo(() => {
    const players = getTenantPlayers(tenantId);
    return new Map(players.map((player) => [player.id, player]));
  }, [tenantId, revision]);

  const legacyRows = useMemo(() => {
    if (!clubRecord) {
      return [];
    }

    const clubPlayers = clubId ? loadPlayersForClub(clubId) : [];
    const clubPlayerById = new Map(clubPlayers.map((player) => [player.id, player]));

    return members
      .map((member) => {
        const player = clubPlayerById.get(member.playerId) || playersById.get(member.playerId);
        const linkedUserId =
          findUserIdByPlayerId(member.playerId) ||
          String(player?.authUserId || "").trim() ||
          null;
        const governanceRole = resolveMemberGovernanceRole(
          linkedUserId,
          clubRecord.governance,
          getVicePresidentUserIds
        );

        return {
          id: member.id,
          name: player?.name || member.playerId,
          governanceRole,
          memberRole: CLUB_MEMBER_ROLE_LABELS[member.role] || member.role,
          status: member.status,
          isActive: member.status === CLUB_MEMBER_STATUSES.ACTIVE,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [members, playersById, clubRecord, clubId]);

  const v2Rows = useMemo(
    () => buildMemberRowsFromV2Members(v2.members, clubRecord?.governance, getVicePresidentUserIds),
    [v2.members, clubRecord]
  );

  const loading = v2Enabled && fullAccess && (v2.status === "idle" || v2.status === "loading");
  const rows = v2Enabled && v2.status === "ready" ? v2Rows : legacyRows;
  const v2Unavailable = v2Enabled && v2.status === "error";

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

      {fullAccess && v2Unavailable && rows.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Không tải được danh sách thành viên từ máy chủ. Vui lòng thử lại sau.
        </Alert>
      )}

      {fullAccess && loading && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={28} aria-label="Đang tải thành viên" />
        </Stack>
      )}

      {fullAccess && !loading && rows.length === 0 && <ClubEmptyState preset="members" />}

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
