import { useState } from "react";
import {
  Alert,
  Box,
  Button,
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

export default function CoachPackageRegisterPage() {
  const { activeClubId, activeClub } = useClub();
  const { status, rows, error, pending } = useCoachingCollection("packages", {
    clubId: activeClubId,
  });
  const [message, setMessage] = useState("");

  const handleRegister = (pkg) => {
    setMessage(`Đã ghi nhận đăng ký gói "${pkg.name}". CLB sẽ liên hệ xác nhận.`);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Đăng ký gói học
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Chọn gói học phù hợp và gửi yêu cầu đăng ký.
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

      {message ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage("")}>
          {message}
        </Alert>
      ) : null}

      {!activeClubId ? (
        <Alert severity="info">Chọn CLB ở header để đăng ký gói học.</Alert>
      ) : null}

      {status === "loading" || pending ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Đang tải…</Typography>
        </Stack>
      ) : null}

      {status === "denied" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error?.error || "Bạn không có quyền xem gói học."}
        </Alert>
      ) : null}

      {status === "error" ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.error || "Không tải được gói học."}
        </Alert>
      ) : null}

      {activeClubId && status !== "denied" ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên gói</TableCell>
                <TableCell>Số buổi</TableCell>
                <TableCell>Thời hạn (ngày)</TableCell>
                <TableCell>Giá</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {status === "loading" ? "Đang tải…" : "Chưa có gói học nào."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>{row.sessions ?? "—"}</TableCell>
                    <TableCell>{row.durationDays ?? "—"}</TableCell>
                    <TableCell>
                      {row.price
                        ? `${Number(row.price).toLocaleString("vi-VN")} đ`
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleRegister(row)}
                          disabled={pending}
                        >
                          Đăng ký
                        </Button>
                      </Stack>
                    </TableCell>
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
