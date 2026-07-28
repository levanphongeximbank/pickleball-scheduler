import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
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
  FINANCE_LEDGER_EMPTY_DEBT,
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
  createDebt,
  getDebtAgingReport,
  listDebtsResult,
} from "../services/financeLedgerService.js";

const STATUS_LABELS = {
  open: "Chưa trả",
  partial: "Trả một phần",
  paid: "Đã trả",
};

export default function FinanceDebtPage() {
  const { activeClubId, revision } = useClub();
  const { runtime, retry } = useFinanceLedgerRuntime(activeClubId);
  const [form, setForm] = useState({
    customerName: "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const clubId = runtime.clubId;
  const debtsResult = useMemo(
    () =>
      runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL
        ? listDebtsResult(clubId)
        : { ok: true, items: [] },
    [clubId, revision, tick, runtime.mode]
  );
  const aging = useMemo(
    () =>
      runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL
        ? getDebtAgingReport(clubId)
        : { ok: true, buckets: [], totalOutstanding: 0, openCount: 0 },
    [clubId, revision, tick, runtime.mode]
  );

  const handleCreate = () => {
    if (!runtime.allowsWrites || !clubId) {
      setMessage({
        type: "warning",
        text: runtime.userMessage || FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    if (!form.customerName.trim() || !Number(form.amount)) {
      setMessage({ type: "warning", text: "Nhập tên khách và số tiền công nợ." });
      return;
    }

    const result = createDebt(clubId, form);
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
      dueDate: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setMessage({ type: "success", text: "Đã thêm công nợ (local — chế độ tương thích)." });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_VIEW}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Công nợ
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Theo dõi công nợ khách hàng và phân tích tuổi nợ theo CLB.
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

            <Grid container spacing={2} sx={{ mb: 3 }}>
              {(aging.buckets || []).map((bucket) => (
                <Grid key={bucket.label} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        {bucket.label}
                      </Typography>
                      <Typography variant="h6">{formatCurrency(bucket.amount)}</Typography>
                      <Typography variant="caption">{bucket.count} khoản</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Tổng dư nợ
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(aging.totalOutstanding || 0)}
                    </Typography>
                    <Typography variant="caption">{aging.openCount || 0} khoản mở</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Thêm công nợ
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
                    label="Hạn trả"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Ghi chú"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    fullWidth
                  />
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                    Thêm
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <TableContainer component={Card} variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Khách</TableCell>
                    <TableCell align="right">Tổng nợ</TableCell>
                    <TableCell align="right">Đã trả</TableCell>
                    <TableCell align="right">Còn lại</TableCell>
                    <TableCell>Hạn</TableCell>
                    <TableCell>Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(debtsResult.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">{FINANCE_LEDGER_EMPTY_DEBT}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {(debtsResult.items || []).map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell>{debt.customerName}</TableCell>
                      <TableCell align="right">{formatCurrency(debt.amount)}</TableCell>
                      <TableCell align="right">{formatCurrency(debt.paidAmount)}</TableCell>
                      <TableCell align="right">{formatCurrency(debt.balance)}</TableCell>
                      <TableCell>{debt.dueDate}</TableCell>
                      <TableCell>
                        <Chip size="small" label={STATUS_LABELS[debt.status] || debt.status} />
                      </TableCell>
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
