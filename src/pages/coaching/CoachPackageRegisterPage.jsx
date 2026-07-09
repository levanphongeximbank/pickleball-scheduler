import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import { listPackages } from "../../features/coaching/index.js";

export default function CoachPackageRegisterPage() {
  const { activeClubId, activeClub } = useClub();
  const [message, setMessage] = useState("");

  const rows = useMemo(() => {
    if (!activeClubId) return [];
    return listPackages(activeClubId);
  }, [activeClubId]);

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
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
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
      ) : (
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
                    Chưa có gói học nào.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>{row.sessions ?? "—"}</TableCell>
                    <TableCell>{row.durationDays ?? "—"}</TableCell>
                    <TableCell>
                      {row.price ? `${Number(row.price).toLocaleString("vi-VN")} đ` : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end">
                        <Button size="small" variant="contained" onClick={() => handleRegister(row)}>
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
      )}
    </Box>
  );
}
