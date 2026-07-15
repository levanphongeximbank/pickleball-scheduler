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
  canViewFullClubMembers,
  countActiveClubMembers,
  getClubMembers,
  getClubMemberStatusLabel,
  getTenantPlayers,
  getVicePresidentUserIds,
  isClubMemberStatusActive,
  normalizeClubMemberStatus,
} from "../../../features/club/index.js";
import { canonicalMembershipRepository } from "../../../features/club/repositories/index.js";
import { isClubStorageV2Enabled } from "../../../features/club/config/clubRegistryFlags.js";
import { isCanonicalClubRepositoryEnabled } from "../../../features/club/config/canonicalRepositoryFlags.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  MEMBERSHIP_READ_STATE,
  isCanonicalMembershipReadEnabled,
  toMembershipReadSnapshot,
} from "../../../features/club/context/membershipCanonicalReadModel.js";
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
          label={row.statusLabel}
          color={row.isActive ? "success" : "default"}
          aria-label={row.statusLabel}
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
  activeMembershipClubId = null,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const fullAccess = Boolean(
    clubId &&
      user &&
      canViewFullClubMembers(user, clubRecord || { id: clubId }, {
        activeMembershipClubId,
      })
  );

  const canManage =
    fullAccess &&
    manageHref &&
    (!rbacEnabled ||
      !isAuthenticated ||
      can(PERMISSIONS.PLAYER_UPDATE, { clubId, venueId: tenantId }));

  // Phase 45A.2 — Membership canonical READ cutover. The member roster is read
  // through canonicalMembershipRepository (V2 RPC gateway → public.club_members)
  // whenever cloud membership is authoritative (canonical flag OR Club Storage V2).
  // A cloud loading/error state NEVER falls back to the legacy blob roster. The
  // legacy blob join below is used only in explicit offline / no-Supabase mode.
  const canonicalMembershipRead = isCanonicalMembershipReadEnabled({
    canonicalEnabled: isCanonicalClubRepositoryEnabled(),
    v2StorageEnabled: isClubStorageV2Enabled(),
    hasSupabase: hasSupabaseConfig(),
  });

  const [remote, setRemote] = useState({
    state: MEMBERSHIP_READ_STATE.IDLE,
    members: [],
    errorCode: null,
  });

  useEffect(() => {
    if (!canonicalMembershipRead || !fullAccess || !clubId) {
      setRemote({ state: MEMBERSHIP_READ_STATE.IDLE, members: [], errorCode: null });
      return undefined;
    }
    let cancelled = false;
    setRemote((prev) => ({ ...prev, state: MEMBERSHIP_READ_STATE.LOADING }));
    canonicalMembershipRepository
      .listActiveClubMembers(clubId, { includeInactive: true })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setRemote(toMembershipReadSnapshot(result));
      })
      .catch(() => {
        if (!cancelled) {
          setRemote(toMembershipReadSnapshot(null));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canonicalMembershipRead, fullAccess, clubId, revision]);

  const members = useMemo(() => {
    void revision;
    // Offline / no-Supabase only. Never a fallback while canonical read is on.
    if (canonicalMembershipRead || !fullAccess || !clubId) {
      return [];
    }
    return getClubMembers(clubId, tenantId);
  }, [clubId, tenantId, revision, fullAccess, canonicalMembershipRead]);

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
          status: normalizeClubMemberStatus(member.status),
          statusLabel: getClubMemberStatusLabel(member.status),
          isActive: isClubMemberStatusActive(member.status),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [members, playersById, clubRecord, clubId]);

  const canonicalRows = useMemo(
    () => buildMemberRowsFromV2Members(remote.members, clubRecord?.governance, getVicePresidentUserIds),
    [remote.members, clubRecord]
  );

  const loading =
    canonicalMembershipRead &&
    fullAccess &&
    (remote.state === MEMBERSHIP_READ_STATE.IDLE || remote.state === MEMBERSHIP_READ_STATE.LOADING);
  // Cloud mode is authoritative: rows come only from the canonical snapshot (never
  // the legacy blob). Offline mode uses the blob join.
  const rows = canonicalMembershipRead ? canonicalRows : legacyRows;
  const v2Unavailable = canonicalMembershipRead && remote.state === MEMBERSHIP_READ_STATE.ERROR;

  const activeCount = countActiveClubMembers(rows);

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
                        label={row.statusLabel}
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
