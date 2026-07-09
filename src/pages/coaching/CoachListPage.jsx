import { useMemo } from "react";
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { listCoaches } from "../../features/coaching/index.js";

export default function CoachListPage() {
  const { activeClubId, activeClub } = useClub();

  const rows = useMemo(() => {
    if (!activeClubId) return [];
    return listCoaches(activeClubId);
  }, [activeClubId]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Danh sách huấn luyện viên
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Xem HLV và chuyên môn tại CLB.
      </Typography>
      {activeClub?.name ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          CLB: {activeClub.name}
        </Typography>
      ) : null}

      {!activeClubId ? (
        <Alert severity="info">Chọn CLB ở header để xem danh sách huấn luyện viên.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Điện thoại</TableCell>
                <TableCell>Chuyên môn</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    Chưa có huấn luyện viên.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>{row.phone || "—"}</TableCell>
                    <TableCell>{row.specialty || "—"}</TableCell>
                    <TableCell>{row.status || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
