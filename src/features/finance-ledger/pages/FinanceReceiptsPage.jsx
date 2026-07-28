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
import {
  FINANCE_LEDGER_EMPTY_RECEIPT,
  FINANCE_LEDGER_RUNTIME_MODE,
  FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
} from "../runtime/constants.js";
import {
  FinanceLedgerLegacyBanner,
  FinanceLedgerMissingClubState,
  FinanceLedgerUnavailableState,
} from "../runtime/FinanceLedgerStateViews.jsx";
import { useFinanceLedgerRuntime } from "../runtime/useFinanceLedgerRuntime.js";
import {
  createReceipt,
  listDebtsResult,
  listReceiptsResult,
} from "../services/financeLedgerService.js";

const METHOD_OPTIONS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "card", label: "Thẻ" },
  { value: "momo", label: "MoMo" },
];

export default function FinanceReceiptsPage() {
  const { activeClubId, revision } = useClub();
  const { runtime, retry } = useFinanceLedgerRuntime(activeClubId);
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

  const clubId = runtime.clubId;
  const receiptsResult = useMemo(
    () =>
      runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL
        ? listReceiptsResult(clubId)
        : { ok: true, items: [] },
    [clubId, revision, tick, runtime.mode]
  );
  const openDebts = useMemo(() => {
    if (runtime.mode !== FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL) return [];
    return listDebtsResult(clubId).items.filter((debt) => debt.balance > 0);
  }, [clubId, revision, tick, runtime.mode]);

  const handleCreate = () => {
    if (!runtime.allowsWrites || !clubId) {
      setMessage({
        type: "warning",
        text: runtime.userMessage || FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    if (!form.customerName.trim() || !Number(form.amount)) {
      setMessage({ type: "warning", text: "Nhập tên khách và số tiền thu." });
      return;
    }

    const result = createReceipt(clubId, {
      ...form,
      debtId: form.debtId || null,
    });
    if (!result?.ok) {
      setMessage({
        type: "error",
        text: result?.error || FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }

    setForm({
      customerName: "",
      amount: "",
      method: "cash",
      reference: "",
      debtId: "",
      note: "",
    });
    setMessage({ type: "success", text: "Đã ghi nhận phiếu thu (local — chế độ tương thích)." });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_VIEW}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Phiếu thu
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Ghi nhận thanh toán và tự động cấn trừ công nợ nếu chọn khoản nợ.
        </Typography>

        {runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.UNAVAILABLE ? (
          <FinanceLedgerUnavailableState
            message={runtime.userMessage}
            code={runtime.code}
            onRetry={retry}
          />
        ) : null}

        {runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.MISSING_SCOPE ? (
          <FinanceLedgerMissingClubState message={runtime.userMessage} />
        ) : null}

        {runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL ? (
          <>
            <FinanceLedgerLegacyBanner text={runtime.demoBanner} />

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

            <TableContainer component={Card} variant="outlined" sx={{ overflowX: "auto" }}>
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
                  {(receiptsResult.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">{FINANCE_LEDGER_EMPTY_RECEIPT}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {(receiptsResult.items || []).map((receipt) => (
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
          </>
        ) : null}
      </Box>
    </PermissionGate>
  );
}
