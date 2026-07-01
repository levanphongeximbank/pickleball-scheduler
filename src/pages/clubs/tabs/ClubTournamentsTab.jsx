import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  createClubInternalTournament,
  getClubTournaments,
} from "../../../features/club/index.js";

export default function ClubTournamentsTab({ club, tenantId, onNavigateTournament }) {
  const navigate = useNavigate();
  const { switchClub } = useClub();
  const { can, rbacEnabled, isAuthenticated } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);

  const canCreate =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.TOURNAMENT_CREATE, { clubId: club.id, venueId: tenantId });

  const tournaments = useMemo(
    () => getClubTournaments(club.id, tenantId),
    [club.id, tenantId, revision]
  );

  const handleCreate = () => {
    const result = createClubInternalTournament(club.id, { name: name.trim() }, tenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreateOpen(false);
    setName("");
    setRevision((v) => v + 1);
    switchClub(club.id);
    onNavigateTournament?.(result.tournament.id);
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          {tournaments.length} giải nội bộ
        </Typography>
        {canCreate && (
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => setCreateOpen(true)}
          >
            Tạo giải nội bộ
          </Button>
        )}
      </Stack>

      {tournaments.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary" gutterBottom>
            CLB chưa tổ chức giải nội bộ nào.
          </Typography>
          {canCreate && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Tạo giải đầu tiên
            </Button>
          )}
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên giải</TableCell>
                <TableCell>Ngày tạo</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Thể thức</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tournaments.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    {new Date(t.createdAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>{t.mode || t.type}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => {
                        switchClub(club.id);
                        navigate(`/tournament/internal/${t.id}`);
                      }}
                    >
                      Chi tiết
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo giải nội bộ — {club.name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Tên giải"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={handleCreate}>
            Tạo & mở thiết lập
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
