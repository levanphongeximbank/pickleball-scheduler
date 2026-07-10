import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
  updateClubMemberRole,
  updateClubMemberStatus,
  canViewFullClubMembers,
  canDeleteClubMembers,
  canApproveClubMembershipRequests,
  listPendingMembershipRequests,
  approveClubMembershipRequest,
  rejectClubMembershipRequest,
} from "../../../features/club/index.js";
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

  const fullAccess = canViewFullClubMembers(user, club);
  const canApproveRequests = canApproveClubMembershipRequests(user, club);

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
    (!rbacEnabled ||
      !isAuthenticated ||
      can(PERMISSIONS.PLAYER_UPDATE, { clubId: club.id, venueId: tenantId }));

  const canRemoveMembers = canDeleteClubMembers(user, club) && canManage;

  const members = useMemo(
    () => getClubMembers(club.id, tenantId),
    [club.id, tenantId, revision]
  );

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

  const existingMemberIds = useMemo(
    () => new Set(members.filter((m) => m.status === CLUB_MEMBER_STATUSES.ACTIVE).map((m) => m.playerId)),
    [members]
  );

  const availablePlayers = useMemo(
    () => getTenantPlayers(tenantId).filter((p) => !existingMemberIds.has(p.id)),
    [tenantId, existingMemberIds, revision]
  );

  const handleAdd = () => {
    const result = addMemberToClub(club.id, selectedPlayerId, tenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAddOpen(false);
    setSelectedPlayerId("");
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    const result = removeMemberFromClub(club.id, removeTarget.playerId, tenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRemoveTarget(null);
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const handleRoleChange = (playerId, role) => {
    const result = updateClubMemberRole(club.id, playerId, role, tenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  const handleStatusToggle = (member) => {
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

      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          {members.length} thành viên
        </Typography>
        {canManage && (
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setAddOpen(true)}>
            Thêm thành viên
          </Button>
        )}
      </Stack>

      {members.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">CLB chưa có thành viên.</Typography>
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
                    {canRemoveMembers && (
                      <TableCell align="right">Thao tác</TableCell>
                    )}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => {
                const player = playersById.get(member.playerId);
                const rating = ratingByPlayer.get(member.playerId);
                return (
                  <TableRow key={member.id} hover>
                    <TableCell>{player?.name || member.playerId}</TableCell>
                    <TableCell>{player?.phone || "—"}</TableCell>
                    <TableCell>{player?.gender || "—"}</TableCell>
                    <TableCell>{player?.level ?? rating?.level ?? "—"}</TableCell>
                    <TableCell align="right">{rating?.elo ?? "—"}</TableCell>
                    <TableCell>
                      {canManage ? (
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
                        CLUB_MEMBER_ROLE_LABELS[member.role] || member.role
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(member.joinedAt).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={member.status === CLUB_MEMBER_STATUSES.ACTIVE ? "Active" : "Inactive"}
                        color={member.status === CLUB_MEMBER_STATUSES.ACTIVE ? "success" : "default"}
                        onClick={canManage ? () => handleStatusToggle(member) : undefined}
                      />
                    </TableCell>
                    {canRemoveMembers && (
                      <TableCell align="right">
                        {member.status === CLUB_MEMBER_STATUSES.ACTIVE && (
                          <Tooltip title="Xóa khỏi CLB">
                            <IconButton size="small" color="error" onClick={() => setRemoveTarget(member)}>
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
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
          <Button onClick={() => setAddOpen(false)}>Hủy</Button>
          <Button variant="contained" disabled={!selectedPlayerId} onClick={handleAdd}>
            Thêm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)}>
        <DialogTitle>Xóa thành viên</DialogTitle>
        <DialogContent>
          <Typography>
            Xóa{" "}
            <strong>{playersById.get(removeTarget?.playerId)?.name || removeTarget?.playerId}</strong>{" "}
            khỏi CLB?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Hủy</Button>
          <Button color="error" variant="contained" onClick={handleRemove}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}
    </Box>
  );
}
