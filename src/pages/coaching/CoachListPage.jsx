import {
  Alert,
  Box,
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
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useCoachingCollection } from "../../features/coaching/runtime/useCoachingCollection.js";

export default function CoachListPage() {
  const { activeClubId, activeClub } = useClub();
  const { status, rows, error, pending } = useCoachingCollection("coaches", {
    clubId: activeClubId,
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Danh sách huấn luyện viên
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Xem HLV và chuyên môn tại CLB.
      </Typography>
      {activeClub?.name ? (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 2 }}
        >
          CLB: {activeClub.name}
        </Typography>
      ) : null}

      {!activeClubId ? (
        <Alert severity="info">
          Chọn CLB ở header để xem danh sách huấn luyện viên.
        </Alert>
      ) : null}

      {status === "loading" || pending ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Đang tải…</Typography>
        </Stack>
      ) : null}

      {status === "denied" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error?.error || "Bạn không có quyền xem danh sách HLV."}
        </Alert>
      ) : null}

      {status === "error" ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.error || "Không tải được danh sách HLV."}
        </Alert>
      ) : null}

      {activeClubId && status !== "denied" ? (
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
                    {status === "loading"
                      ? "Đang tải…"
                      : "Chưa có huấn luyện viên."}
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
      ) : null}
    </Box>
  );
}
