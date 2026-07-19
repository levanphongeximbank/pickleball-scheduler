import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import RestoreIcon from "@mui/icons-material/Restore";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  CLUB_MEMBER_ROLE_LABELS,
  CLUB_MEMBER_STATUSES,
  addMemberToClub,
  getClubMembers,
  getClubRatings,
  getTenantPlayers,
  removeMemberFromClub,
  restoreMemberToClub,
  updateClubMemberRole,
  updateClubMemberStatus,
  canViewFullClubMembers,
  canDeleteClubMembers,
  canManageClubGovernance,
  canApproveClubMembershipRequests,
  countActiveClubMembers,
  formatMemberCommandUserError,
  getClubMemberStatusLabel,
  isClubMemberStatusActive,
  isClubStorageV2Enabled,
  listPendingMembershipRequests,
  mapV2MemberRowToUi,
  approveClubMembershipRequest,
  rejectClubMembershipRequest,
  probeClubMemberMutationAccess,
  isProtectedGovernanceMember,
} from "../../../features/club/index.js";
import { canonicalMembershipRepository } from "../../../features/club/repositories/index.js";
import { isCanonicalClubRepositoryEnabled } from "../../../features/club/config/canonicalRepositoryFlags.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  MEMBERSHIP_READ_STATE,
  isCanonicalMembershipReadEnabled,
  toMembershipReadSnapshot,
} from "../../../features/club/context/membershipCanonicalReadModel.js";
import { formatPickVnRating } from "../../../features/pick-vn-rating/constants/pickVnRatingScale.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../../../features/identity/services/auditService.js";
import { getCurrentUser } from "../../../auth/authService.js";

export default function ClubMembersTab({ club, tenantId, onRefresh }) {
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [error, setError] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [revision, setRevision] = useState(0);
  const [reviewNotes, setReviewNotes] = useState({});
  const [requestMessage, setRequestMessage] = useState(null);
  const [pendingMembershipRequests, setPendingMembershipRequests] = useState([]);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(false);
  const [memberState, setMemberState] = useState({
    state: MEMBERSHIP_READ_STATE.IDLE,
    list: [],
    errorCode: null,
  });
  const [memberCommandReady, setMemberCommandReady] = useState(!isClubStorageV2Enabled());
  const [mutationBusy, setMutationBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [restoreTarget, setRestoreTarget] = useState(null);

  const fullAccess = canViewFullClubMembers(user, club);
  const canApproveRequests = canApproveClubMembershipRequests(user, club);
  const governanceWriteAllowed = canManageClubGovernance(user, club);
  // Phase 45A.2 — member roster reads flow through canonicalMembershipRepository
  // whenever cloud membership is authoritative (Club Storage V2 OR canonical repo flag).
  // The legacy blob join is used only in explicit offline/no-Supabase mode.
  const canonicalMembershipRead = isCanonicalMembershipReadEnabled({
    canonicalEnabled: isCanonicalClubRepositoryEnabled(),
    v2StorageEnabled: isClubStorageV2Enabled(),
    hasSupabase: hasSupabaseConfig(),
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      if (!canApproveRequests) {
        setPendingMembershipRequests([]);
        return;
      }

      setLoadingPendingRequests(true);
      try {
        const rows = await listPendingMembershipRequests(club.id, tenantId, user);
        if (!cancelled) {
          setPendingMembershipRequests(rows);
        }
      } finally {
        if (!cancelled) {
          setLoadingPendingRequests(false);
        }
      }
    }

    loadPending();
    return () => {
      cancelled = true;
    };
  }, [club.id, tenantId, user, revision, canApproveRequests]);

  const canManage =
    fullAccess &&
    governanceWriteAllowed &&
    (!rbacEnabled ||
      !isAuthenticated ||
      can(PERMISSIONS.PLAYER_UPDATE, { clubId: club.id, venueId: tenantId }));

  // Phase 1C — write visibility aligns with Phase 1B governance authz (not list-only probe).
  // Role/status remain legacy-only (disabled while canonical membership read is on).
  const addRemoveEnabled =
    canManage && (canonicalMembershipRead ? memberCommandReady : true);
  const roleStatusEnabled = canManage && !canonicalMembershipRead;
  const canRemoveMembers = canDeleteClubMembers(user, club) && addRemoveEnabled;
  const canRestoreMembers = addRemoveEnabled && canonicalMembershipRead;

  useEffect(() => {
    let cancelled = false;
    if (!canonicalMembershipRead) {
      setMemberCommandReady(true);
      return undefined;
    }
    setMemberCommandReady(false);
    void probeClubMemberMutationAccess(club.id).then((result) => {
      if (!cancelled) {
        setMemberCommandReady(Boolean(result?.ok));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [club.id, canonicalMembershipRead]);

  useEffect(() => {
    let cancelled = false;

    if (!fullAccess) {
      setMemberState({ state: MEMBERSHIP_READ_STATE.IDLE, list: [], errorCode: null });
      return undefined;
    }

    if (!canonicalMembershipRead) {
      // Explicit offline / no-Supabase mode: legacy blob join is the read path.
      setMemberState({
        state: MEMBERSHIP_READ_STATE.READY,
        list: getClubMembers(club.id, tenantId),
        errorCode: null,
      });
      return undefined;
    }

    setMemberState((prev) => ({ ...prev, state: MEMBERSHIP_READ_STATE.LOADING }));
    canonicalMembershipRepository
      .listActiveClubMembers(club.id, { includeInactive: true })
      .then((result) => {
        if (cancelled) {
          return;
        }
        // Cloud is authoritative: loading/error NEVER backfills from the local blob.
        const snapshot = toMembershipReadSnapshot(result);
        setMemberState({
          state: snapshot.state,
          list: snapshot.members.map(mapV2MemberRowToUi),
          errorCode: snapshot.errorCode,
        });
      })
      .catch(() => {
        if (!cancelled) {
          const snapshot = toMembershipReadSnapshot(null);
          setMemberState({ state: snapshot.state, list: [], errorCode: snapshot.errorCode });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [club.id, tenantId, revision, canonicalMembershipRead, fullAccess]);

  const members = memberState.list;
  const filteredMembers = useMemo(() => {
    if (statusFilter === "all") {
      return members;
    }
    if (statusFilter === "active") {
      return members.filter((m) => isClubMemberStatusActive(m.status));
    }
    if (statusFilter === "left") {
      return members.filter((m) => m.status === CLUB_MEMBER_STATUSES.LEFT);
    }
    if (statusFilter === "removed") {
      return members.filter((m) => m.status === CLUB_MEMBER_STATUSES.REMOVED);
    }
    return members;
  }, [members, statusFilter]);
  const membersLoading =
    canonicalMembershipRead &&
    fullAccess &&
    (memberState.state === MEMBERSHIP_READ_STATE.IDLE ||
      memberState.state === MEMBERSHIP_READ_STATE.LOADING);
  const membersError =
    memberState.state === MEMBERSHIP_READ_STATE.ERROR
      ? "Không tải được danh sách thành viên. Vui lòng thử lại."
      : null;

  const bumpAfterMutation = () => {
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const ratings = useMemo(
    () => getClubRatings(club.id, tenantId),
    [club.id, tenantId, revision]
  );

  const playersById = useMemo(() => {
    const players = getTenantPlayers(tenantId);
    return new Map(players.map((p) => [p.id, p]));
  }, [tenantId, revision]);

  const ratingByPlayer = useMemo(
    () => new Map(ratings.map((r) => [r.playerId, r])),
    [ratings]
  );

  const existingMemberIds = useMemo(() => {
    const ids = new Set();
    for (const m of members) {
      if (m.status !== CLUB_MEMBER_STATUSES.ACTIVE) continue;
      if (m.userId) ids.add(m.userId);
      if (m.playerId) ids.add(m.playerId);
    }
    return ids;
  }, [members]);

  const availablePlayers = useMemo(() => {
    return getTenantPlayers(tenantId).filter((p) => {
      if (existingMemberIds.has(p.id)) return false;
      const authId = String(p.authUserId || "").trim();
      if (authId && existingMemberIds.has(authId)) return false;
      return true;
    });
  }, [tenantId, existingMemberIds, revision]);

  const handleAdd = async () => {
    if (!selectedPlayerId || mutationBusy) return;
    setError(null);
    setMutationBusy(true);
    try {
      const result = await addMemberToClub(club.id, selectedPlayerId, tenantId, {
        expectedVersion: club.version ?? null,
      });
      if (!result.ok) {
        setError(formatMemberCommandUserError(result, "Không thêm được thành viên."));
        if (result.serverCode === "VERSION_CONFLICT") {
          bumpAfterMutation();
        }
        return;
      }
      setAddOpen(false);
      setSelectedPlayerId("");
      bumpAfterMutation();
    } finally {
      setMutationBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget || mutationBusy) return;
    if (isProtectedGovernanceMember(removeTarget)) {
      setError("Chủ tịch/Chủ sở hữu phải chuyển quyền trước khi bị gỡ.");
      setRemoveTarget(null);
      return;
    }
    setError(null);
    setMutationBusy(true);
    try {
      const result = await removeMemberFromClub(club.id, removeTarget.playerId, tenantId, {
        targetUserId: removeTarget.userId || null,
        expectedVersion: removeTarget.version ?? club.version ?? null,
      });
      if (!result.ok) {
        setError(formatMemberCommandUserError(result, "Không gỡ được thành viên."));
        if (result.serverCode === "VERSION_CONFLICT") {
          bumpAfterMutation();
        }
        return;
      }
      setRemoveTarget(null);
      bumpAfterMutation();
    } finally {
      setMutationBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget || mutationBusy) return;
    setError(null);
    setMutationBusy(true);
    try {
      const result = await restoreMemberToClub(club.id, restoreTarget.playerId, tenantId, {
        targetUserId: restoreTarget.userId || null,
        expectedVersion: restoreTarget.version ?? club.version ?? null,
      });
      if (!result.ok) {
        setError(formatMemberCommandUserError(result, "Không khôi phục được thành viên."));
        if (result.serverCode === "VERSION_CONFLICT") {
          bumpAfterMutation();
        }
        return;
      }
      setRestoreTarget(null);
      bumpAfterMutation();
    } finally {
      setMutationBusy(false);
    }
  };

  const handleRoleChange = (playerId, role) => {
    if (!roleStatusEnabled) return;
    const result = updateClubMemberRole(club.id, playerId, role, tenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const handleStatusToggle = (member) => {
    if (!roleStatusEnabled) return;
    const nextStatus =
      member.status === CLUB_MEMBER_STATUSES.ACTIVE
        ? CLUB_MEMBER_STATUSES.INACTIVE
        : CLUB_MEMBER_STATUSES.ACTIVE;
    const result = updateClubMemberStatus(club.id, member.playerId, nextStatus, tenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const handleApproveRequest = async (request) => {
    const result = await approveClubMembershipRequest(club.id, request.id, tenantId, {
      user,
      reviewNote: reviewNotes[request.id] || "",
    });

    if (!result.ok) {
      setRequestMessage({ type: "error", text: result.error });
      return;
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: "club_membership_request",
      resourceId: request.id,
      clubId: club.id,
      metadata: {
        status: "approved",
        userId: request.userId,
        playerId: result.player?.id,
      },
      actor: getCurrentUser(),
    });

    setRequestMessage({ type: "success", text: "Đã duyệt yêu cầu tham gia CLB." });
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const handleRejectRequest = async (request) => {
    const result = await rejectClubMembershipRequest(club.id, request.id, tenantId, {
      user,
      reviewNote: reviewNotes[request.id] || "",
    });

    if (!result.ok) {
      setRequestMessage({ type: "error", text: result.error });
      return;
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: "club_membership_request",
      resourceId: request.id,
      clubId: club.id,
      metadata: {
        status: "rejected",
        userId: request.userId,
      },
      actor: getCurrentUser(),
    });

    setRequestMessage({ type: "info", text: "Đã từ chối yêu cầu tham gia." });
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  return (
    <Box>
      {!fullAccess && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Bạn không có quyền xem danh sách thành viên CLB này. Chỉ Chủ tịch / Chủ sở hữu CLB mới
          xem được chi tiết.
        </Alert>
      )}

      {fullAccess && error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {fullAccess && (
        <>
      {canApproveRequests && requestMessage && (
        <Alert
          severity={requestMessage.type}
          sx={{ mb: 2 }}
          onClose={() => setRequestMessage(null)}
        >
          {requestMessage.text}
        </Alert>
      )}

      {canApproveRequests && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Yêu cầu tham gia ({pendingMembershipRequests.length})
          </Typography>
          {pendingMembershipRequests.length === 0 ? (
            <Paper sx={{ p: 2 }}>
              <Typography color="text.secondary" variant="body2">
                Không có yêu cầu đang chờ duyệt.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>VĐV</TableCell>
                    <TableCell>Pick_VN</TableCell>
                    <TableCell>Ngày gửi</TableCell>
                    <TableCell>Lời nhắn</TableCell>
                    <TableCell>Ghi chú duyệt</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingMembershipRequests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>{request.displayName || request.userId}</TableCell>
                      <TableCell>
                        {request.pickVnRating != null
                          ? formatPickVnRating(request.pickVnRating)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(request.requestedAt).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell>{request.message || "—"}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Ghi chú"
                          value={reviewNotes[request.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((prev) => ({
                              ...prev,
                              [request.id]: event.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            color="success"
                            variant="contained"
                            onClick={() => handleApproveRequest(request)}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleRejectRequest(request)}
                          >
                            Từ chối
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {canonicalMembershipRead && canManage && !addRemoveEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Danh sách thành viên lấy từ máy chủ (Club Storage V2). Đang kiểm tra lệnh thêm/gỡ
          thành viên cloud…
        </Alert>
      )}
      {canonicalMembershipRead && canManage && addRemoveEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Danh sách thành viên lấy từ máy chủ (Club Storage V2). Thêm / gỡ thành viên chạy qua
          lệnh cloud. Đổi vai trò / trạng thái tạm thời tắt.
        </Alert>
      )}

      {membersError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {membersError}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle1" fontWeight={600}>
            {countActiveClubMembers(members)} thành viên đang hoạt động
          </Typography>
          {canonicalMembershipRead && (
            <TextField
              select
              size="small"
              label="Lọc"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="active">Đang hoạt động</MenuItem>
              <MenuItem value="left">Đã rời</MenuItem>
              <MenuItem value="removed">Đã gỡ</MenuItem>
              <MenuItem value="all">Tất cả</MenuItem>
            </TextField>
          )}
          {club.version != null && (
            <Typography variant="caption" color="text.secondary">
              CLB v{club.version}
            </Typography>
          )}
        </Stack>
        {addRemoveEnabled && (
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            disabled={mutationBusy}
            onClick={() => setAddOpen(true)}
          >
            Thêm thành viên
          </Button>
        )}
      </Stack>

      {membersLoading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={28} aria-label="Đang tải thành viên" />
        </Stack>
      ) : filteredMembers.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">
            {membersError
              ? "Không tải được danh sách thành viên."
              : statusFilter === "active"
                ? "CLB chưa có thành viên đang hoạt động."
                : "Không có thành viên trong bộ lọc này."}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>SĐT</TableCell>
                <TableCell>Giới tính</TableCell>
                <TableCell>Level</TableCell>
                <TableCell align="right">ELO</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell>Ngày tham gia</TableCell>
                <TableCell>Trạng thái</TableCell>
                    {(canRemoveMembers || canRestoreMembers) && (
                      <TableCell align="right">Thao tác</TableCell>
                    )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMembers.map((member) => {
                const player = playersById.get(member.playerId);
                const rating = ratingByPlayer.get(member.playerId);
                const canRestoreRow =
                  canRestoreMembers &&
                  (member.status === CLUB_MEMBER_STATUSES.LEFT ||
                    member.status === CLUB_MEMBER_STATUSES.REMOVED);
                return (
                  <TableRow key={member.id} hover>
                    <TableCell>{member.displayName || player?.name || member.playerId}</TableCell>
                    <TableCell>{player?.phone || "—"}</TableCell>
                    <TableCell>{player?.gender || "—"}</TableCell>
                    <TableCell>{player?.level ?? rating?.level ?? "—"}</TableCell>
                    <TableCell align="right">{rating?.elo ?? "—"}</TableCell>
                    <TableCell>
                      {roleStatusEnabled ? (
                        <TextField
                          select
                          size="small"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.playerId, e.target.value)}
                          sx={{ minWidth: 120 }}
                        >
                          {Object.entries(CLUB_MEMBER_ROLE_LABELS).map(([value, label]) => (
                            <MenuItem key={value} value={value}>
                              {label}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        CLUB_MEMBER_ROLE_LABELS[member.role] ||
                        (Array.isArray(member.governanceRoles) && member.governanceRoles.length
                          ? member.governanceRoles.join(", ")
                          : "Thành viên")
                      )}
                    </TableCell>
                    <TableCell>
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString("vi-VN")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={getClubMemberStatusLabel(member.status)}
                        color={isClubMemberStatusActive(member.status) ? "success" : "default"}
                        onClick={
                          roleStatusEnabled &&
                          (isClubMemberStatusActive(member.status) ||
                            member.status === CLUB_MEMBER_STATUSES.INACTIVE)
                            ? () => handleStatusToggle(member)
                            : undefined
                        }
                      />
                    </TableCell>
                    {(canRemoveMembers || canRestoreMembers) && (
                      <TableCell align="right">
                        {isClubMemberStatusActive(member.status) &&
                          canRemoveMembers &&
                          !isProtectedGovernanceMember(member) && (
                          <Tooltip title="Xóa khỏi CLB">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={mutationBusy}
                                onClick={() => setRemoveTarget(member)}
                              >
                                <PersonRemoveIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {canRestoreRow && (
                          <Tooltip title="Khôi phục vào CLB">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={mutationBusy}
                                onClick={() => setRestoreTarget(member)}
                              >
                                <RestoreIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Thêm thành viên</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Chọn player"
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            sx={{ mt: 1 }}
          >
            {availablePlayers.length === 0 && (
              <MenuItem disabled>Không còn player khả dụng trong tenant</MenuItem>
            )}
            {availablePlayers.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} {p.phone ? `— ${p.phone}` : ""}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={mutationBusy}>
            Hủy
          </Button>
          <Button
            variant="contained"
            disabled={!selectedPlayerId || mutationBusy}
            onClick={handleAdd}
          >
            {mutationBusy ? "Đang thêm…" : "Thêm"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(removeTarget)} onClose={() => !mutationBusy && setRemoveTarget(null)}>
        <DialogTitle>Xóa thành viên</DialogTitle>
        <DialogContent>
          <Typography>
            Xóa{" "}
            <strong>
              {removeTarget?.displayName ||
                playersById.get(removeTarget?.playerId)?.name ||
                removeTarget?.playerId}
            </strong>{" "}
            khỏi CLB?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)} disabled={mutationBusy}>
            Hủy
          </Button>
          <Button color="error" variant="contained" disabled={mutationBusy} onClick={handleRemove}>
            {mutationBusy ? "Đang gỡ…" : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(restoreTarget)} onClose={() => !mutationBusy && setRestoreTarget(null)}>
        <DialogTitle>Khôi phục thành viên</DialogTitle>
        <DialogContent>
          <Typography>
            Khôi phục{" "}
            <strong>
              {restoreTarget?.displayName ||
                playersById.get(restoreTarget?.playerId)?.name ||
                restoreTarget?.playerId}
            </strong>{" "}
            vào CLB với trạng thái đang hoạt động?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreTarget(null)} disabled={mutationBusy}>
            Hủy
          </Button>
          <Button variant="contained" disabled={mutationBusy} onClick={handleRestore}>
            {mutationBusy ? "Đang khôi phục…" : "Khôi phục"}
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}
    </Box>
  );
}
