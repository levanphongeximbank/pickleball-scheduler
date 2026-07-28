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
  FINANCE_LEDGER_EMPTY_REFUND,
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
  createRefund,
  listRefundsResult,
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
  const { runtime, retry } = useFinanceLedgerRuntime(activeClubId);
  const [form, setForm] = useState({
    customerName: "",
    amount: "",
    reason: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const clubId = runtime.clubId;
  const refundsResult = useMemo(
    () =>
      runtime.mode === FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL
        ? listRefundsResult(clubId)
        : { ok: true, items: [] },
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
      setMessage({ type: "warning", text: "Nhập tên khách và số tiền hoàn." });
      return;
    }

    const result = createRefund(clubId, form);
    if (!result?.ok) {
      setMessage({
        type: "error",
        text: result?.error || FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }

    setForm({ customerName: "", amount: "", reason: "" });
    setMessage({
      type: "success",
      text: "Đã tạo yêu cầu hoàn tiền (local — chế độ tương thích).",
    });
    setTick((value) => value + 1);
  };

  const handleStatus = (refundId, status) => {
    if (!runtime.allowsWrites || !clubId) {
      setMessage({
        type: "warning",
        text: runtime.userMessage || FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    const result = updateRefundStatus(clubId, refundId, status);
    if (!result?.ok) {
      setMessage({
        type: "error",
        text: result?.error || FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_VIEW}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Hoàn tiền
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Quản lý yêu cầu hoàn tiền và trạng thái phê duyệt.
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

            <TableContainer component={Card} variant="outlined" sx={{ overflowX: "auto" }}>
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
                  {(refundsResult.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">{FINANCE_LEDGER_EMPTY_REFUND}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {(refundsResult.items || []).map((refund) => (
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
          </>
        ) : null}
      </Box>
    </PermissionGate>
  );
}
