import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
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
} from "../../../features/club/index.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { findUserIdByPlayerId } from "../../../features/club/storage/athleteClubLinkStore.js";
import { resolveMemberGovernanceRole } from "./myClubViewLogic.js";

export default function MyClubMembersPanel({
  clubId,
  tenantId,
  clubRecord,
  user,
  manageHref = null,
  revision = 0,
}) {
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const fullAccess = clubRecord && user && canViewFullClubMembers(user, clubRecord);

  const canManage =
    fullAccess &&
    manageHref &&
    (!rbacEnabled ||
      !isAuthenticated ||
      can(PERMISSIONS.PLAYER_UPDATE, { clubId, venueId: tenantId }));

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

  const rows = useMemo(() => {
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
          <Typography variant="subtitle1" fontWeight={700}>
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

      {fullAccess && rows.length === 0 && (
        <Alert severity="info">CLB chưa có thành viên trong danh sách.</Alert>
      )}

      {fullAccess && rows.length > 0 && (
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
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{row.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {row.governanceRole && (
                        <Chip size="small" label={row.governanceRole} color="primary" variant="outlined" />
                      )}
                      <Chip size="small" label={row.memberRole} variant="outlined" />
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
