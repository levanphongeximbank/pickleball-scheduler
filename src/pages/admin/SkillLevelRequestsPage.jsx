import { useMemo, useState } from "react";

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
  TextField,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import TournamentPageHeader from "../../components/tournament/TournamentPageHeader.jsx";
import { TOURNAMENT_LAYOUT } from "../../components/tournament/tournamentLayout.js";
import {
  approveSkillLevelChangeRequest,
  listPendingSkillLevelChangeRequests,
  rejectSkillLevelChangeRequest,
} from "../../domain/skillLevelChangeService.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../../features/identity/services/auditService.js";
import { getCurrentUser } from "../../auth/authService.js";

export default function SkillLevelRequestsPage() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewNotes, setReviewNotes] = useState({});
  const [actionMessage, setActionMessage] = useState(null);

  const pendingRequests = useMemo(() => {
    void refreshKey;
    return listPendingSkillLevelChangeRequests();
  }, [refreshKey]);

  const handleApprove = async (request) => {
    const result = approveSkillLevelChangeRequest(request.clubId, request.id, {
      reviewedBy: user?.email || user?.id || null,
      reviewNote: reviewNotes[request.id] || "",
    });

    if (!result.ok) {
      setActionMessage({ type: "error", text: result.error });
      return;
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: "skill_level_change_request",
      resourceId: request.id,
      clubId: request.clubId,
      metadata: {
        status: "approved",
        playerId: request.playerId,
        from: request.currentLevel,
        to: request.requestedLevel,
      },
      actor: getCurrentUser(),
    });

    setActionMessage({ type: "success", text: "Đã duyệt yêu cầu thay đổi trình độ." });
    setRefreshKey((value) => value + 1);
  };

  const handleReject = async (request) => {
    const result = rejectSkillLevelChangeRequest(request.clubId, request.id, {
      reviewedBy: user?.email || user?.id || null,
      reviewNote: reviewNotes[request.id] || "",
    });

    if (!result.ok) {
      setActionMessage({ type: "error", text: result.error });
      return;
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: "skill_level_change_request",
      resourceId: request.id,
      clubId: request.clubId,
      metadata: {
        status: "rejected",
        playerId: request.playerId,
      },
      actor: getCurrentUser(),
    });

    setActionMessage({ type: "success", text: "Đã từ chối yêu cầu." });
    setRefreshKey((value) => value + 1);
  };

  return (
    <Box>
      <TournamentPageHeader
        title="Duyệt thay đổi trình độ"
        description="Hàng chờ yêu cầu thay đổi điểm trình độ từ vận động viên — chỉ kỹ thuật viên hệ thống duyệt."
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Làm mới
          </Button>
        }
      />

      {actionMessage && (
        <Alert
          severity={actionMessage.type === "error" ? "error" : "success"}
          sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}
          onClose={() => setActionMessage(null)}
        >
          {actionMessage.text}
        </Alert>
      )}

      <PermissionGate permission={PERMISSIONS.SKILL_LEVEL_APPROVE}>
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>VĐV</TableCell>
                  <TableCell>CLB</TableCell>
                  <TableCell>Hiện tại → Đề xuất</TableCell>
                  <TableCell>Lý do</TableCell>
                  <TableCell>Ghi chú duyệt</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Không có yêu cầu đang chờ duyệt.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRequests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>
                        <Typography fontWeight={700}>{request.playerName || request.playerId}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(request.requestedAt).toLocaleString("vi-VN")}
                        </Typography>
                      </TableCell>
                      <TableCell>{request.clubName || request.clubId}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={`${Number(request.currentLevel).toFixed(1)} → ${Number(request.requestedLevel).toFixed(1)}`}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>{request.reason}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Ghi chú (tuỳ chọn)"
                          value={reviewNotes[request.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
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
                            startIcon={<CheckIcon />}
                            onClick={() => handleApprove(request)}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            variant="outlined"
                            startIcon={<CloseIcon />}
                            onClick={() => handleReject(request)}
                          >
                            Từ chối
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </PermissionGate>
    </Box>
  );
}
