import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { TOURNAMENT_LEVEL_LABELS } from "../../models/tournament/constants.js";
import {
  approveCertification,
  listAllCertifications,
  rejectCertification,
  toggleRankingEnabled,
} from "../../features/vpr-ranking/services/tournamentCertificationService.js";

export default function TournamentCertificationQueuePage() {
  const { can, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  const canCertify = can(PERMISSIONS.TOURNAMENT_CERTIFY);
  const canManageRanking = can(PERMISSIONS.RANKING_MANAGE);

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = listAllCertifications();
    setRows(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleApprove = async (id) => {
    setError(null);
    const result = await approveCertification(id, { actorUserId: user?.id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  };

  const openReject = (id) => {
    setSelectedId(id);
    setRejectReason("");
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!selectedId) {
      return;
    }
    const result = await rejectCertification(selectedId, {
      actorUserId: user?.id,
      reason: rejectReason,
    });
    setRejectOpen(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  };

  const handleToggleRanking = async (row, enabled) => {
    const result = await toggleRankingEnabled(row.id, enabled, { actorUserId: user?.id });
    if (!result.ok) {
      setError(result.error || "Không thể đổi trạng thái ranking.");
      return;
    }
    refresh();
  };

  if (!canCertify && !canManageRanking) {
    return <Alert severity="warning">Bạn không có quyền duyệt giải VPR.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Duyệt giải Pick_VN Certified
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Giải</TableCell>
              <TableCell>CLB / Host</TableCell>
              <TableCell>Cấp</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ranking</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    {loading ? "Đang tải..." : "Không có giải chờ duyệt."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.hostClubName || row.clubId}</TableCell>
                <TableCell>
                  {TOURNAMENT_LEVEL_LABELS[row.tournamentLevel] || row.tournamentLevel}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={row.certificationStatus} />
                </TableCell>
                <TableCell>
                  {canManageRanking ? (
                    <Switch
                      size="small"
                      checked={row.rankingEnabled === true}
                      onChange={(event) => handleToggleRanking(row, event.target.checked)}
                    />
                  ) : (
                    row.rankingEnabled ? "Bật" : "Tắt"
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {canCertify && row.certificationStatus === "pending" && (
                      <>
                        <Button size="small" variant="contained" onClick={() => handleApprove(row.id)}>
                          Duyệt
                        </Button>
                        <Button size="small" color="error" onClick={() => openReject(row.id)}>
                          Từ chối
                        </Button>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Từ chối xác thực giải</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Lý do từ chối"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Hủy</Button>
          <Button color="error" variant="contained" onClick={handleReject}>
            Từ chối
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
