import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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

import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { useClub } from "../../../context/ClubContext.jsx";
import { formatCurrency } from "../../../domain/courtBookingEngine.js";
import {
  createRefund,
  listRefunds,
  updateRefundStatus,
} from "../services/financeLedgerService.js";

const STATUS_LABELS = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export default function FinanceRefundsPage() {
  const { activeClubId, revision } = useClub();
  const clubId = activeClubId || "demo-club";
  const [form, setForm] = useState({
    customerName: "",
    amount: "",
    reason: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const refunds = useMemo(() => listRefunds(clubId), [clubId, revision, tick]);

  const handleCreate = () => {
    if (!form.customerName.trim() || !Number(form.amount)) {
      setMessage({ type: "warning", text: "Nhập tên khách và số tiền hoàn." });
      return;
    }

    createRefund(clubId, form);
    setForm({ customerName: "", amount: "", reason: "" });
    setMessage({ type: "success", text: "Đã tạo yêu cầu hoàn tiền." });
    setTick((value) => value + 1);
  };

  const handleStatus = (refundId, status) => {
    updateRefundStatus(clubId, refundId, status);
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_VIEW}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Hoàn tiền
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Quản lý yêu cầu hoàn tiền và trạng thái phê duyệt.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Tạo yêu cầu hoàn
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Tên khách"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Số tiền"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              fullWidth
            />
            <TextField
              label="Lý do"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              fullWidth
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Tạo
            </Button>
          </Stack>
        </Card>

        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Khách</TableCell>
                <TableCell align="right">Số tiền</TableCell>
                <TableCell>Lý do</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {refunds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">Chưa có yêu cầu hoàn tiền.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {refunds.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell>{new Date(refund.createdAt).toLocaleString("vi-VN")}</TableCell>
                  <TableCell>{refund.customerName}</TableCell>
                  <TableCell align="right">{formatCurrency(refund.amount)}</TableCell>
                  <TableCell>{refund.reason || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[refund.status] || "default"}
                      label={STATUS_LABELS[refund.status] || refund.status}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {refund.status === "pending" && (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => handleStatus(refund.id, "approved")}>
                          Duyệt
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleStatus(refund.id, "rejected")}
                        >
                          Từ chối
                        </Button>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </PermissionGate>
  );
}
