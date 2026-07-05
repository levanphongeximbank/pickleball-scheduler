import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  MenuItem,
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
import { createReceipt, listDebts, listReceipts } from "../services/financeLedgerService.js";

const METHOD_OPTIONS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "card", label: "Thẻ" },
  { value: "momo", label: "MoMo" },
];

export default function FinanceReceiptsPage() {
  const { activeClubId, revision } = useClub();
  const clubId = activeClubId || "demo-club";
  const [form, setForm] = useState({
    customerName: "",
    amount: "",
    method: "cash",
    reference: "",
    debtId: "",
    note: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const receipts = useMemo(() => listReceipts(clubId), [clubId, revision, tick]);
  const openDebts = useMemo(
    () => listDebts(clubId).filter((debt) => debt.balance > 0),
    [clubId, revision, tick]
  );

  const handleCreate = () => {
    if (!form.customerName.trim() || !Number(form.amount)) {
      setMessage({ type: "warning", text: "Nhập tên khách và số tiền thu." });
      return;
    }

    createReceipt(clubId, {
      ...form,
      debtId: form.debtId || null,
    });
    setForm({
      customerName: "",
      amount: "",
      method: "cash",
      reference: "",
      debtId: "",
      note: "",
    });
    setMessage({ type: "success", text: "Đã ghi nhận phiếu thu." });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_VIEW}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Phiếu thu
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Ghi nhận thanh toán và tự động cấn trừ công nợ nếu chọn khoản nợ.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Tạo phiếu thu
          </Typography>
          <Stack spacing={2}>
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
                select
                label="Phương thức"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                fullWidth
              >
                {METHOD_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Cấn trừ công nợ"
                value={form.debtId}
                onChange={(e) => setForm({ ...form, debtId: e.target.value })}
                fullWidth
              >
                <MenuItem value="">Không cấn trừ</MenuItem>
                {openDebts.map((debt) => (
                  <MenuItem key={debt.id} value={debt.id}>
                    {debt.customerName} — còn {formatCurrency(debt.balance)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Mã tham chiếu"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                fullWidth
              />
              <TextField
                label="Ghi chú"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                fullWidth
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                Ghi nhận
              </Button>
            </Stack>
          </Stack>
        </Card>

        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Khách</TableCell>
                <TableCell align="right">Số tiền</TableCell>
                <TableCell>Phương thức</TableCell>
                <TableCell>Tham chiếu</TableCell>
                <TableCell>Ghi chú</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">Chưa có phiếu thu.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell>{new Date(receipt.createdAt).toLocaleString("vi-VN")}</TableCell>
                  <TableCell>{receipt.customerName}</TableCell>
                  <TableCell align="right">{formatCurrency(receipt.amount)}</TableCell>
                  <TableCell>{receipt.method}</TableCell>
                  <TableCell>{receipt.reference || "—"}</TableCell>
                  <TableCell>{receipt.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </PermissionGate>
  );
}
