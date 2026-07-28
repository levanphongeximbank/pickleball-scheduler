import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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
import {
  CRM_LEGACY_EMPTY_HISTORY,
  CRM_LEGACY_RUNTIME_MODE,
  CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
} from "../runtime/constants.js";
import {
  CrmLegacyDemoBanner,
  CrmLegacyMissingClubState,
  CrmLegacyUnavailableState,
} from "../runtime/CrmLegacyStateViews.jsx";
import { useCrmLegacyRuntime } from "../runtime/useCrmLegacyRuntime.js";
import {
  addContactHistory,
  listContactHistoryResult,
} from "../services/crmContactHistoryService.js";

const CHANNEL_OPTIONS = [
  { value: "sms", label: "SMS" },
  { value: "zalo", label: "Zalo" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Gọi điện" },
];

export default function CrmContactHistoryPage() {
  const { activeClubId, revision } = useClub();
  const { runtime, retry } = useCrmLegacyRuntime(activeClubId);
  const [form, setForm] = useState({
    customerName: "",
    channel: "phone",
    direction: "outbound",
    summary: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const clubId = runtime.clubId;
  const historyResult = useMemo(
    () =>
      runtime.mode === CRM_LEGACY_RUNTIME_MODE.LEGACY_LOCAL
        ? listContactHistoryResult(clubId)
        : { ok: true, items: [] },
    [clubId, revision, tick, runtime.mode]
  );

  const handleCreate = () => {
    if (!runtime.allowsWrites || !clubId) {
      setMessage({
        type: "warning",
        text: runtime.userMessage || CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    if (!form.customerName.trim() || !form.summary.trim()) {
      setMessage({ type: "warning", text: "Nhập tên khách và tóm tắt liên hệ." });
      return;
    }

    const result = addContactHistory(clubId, form);
    if (!result?.ok) {
      setMessage({
        type: "error",
        text: result?.error || CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }

    setForm({ customerName: "", channel: "phone", direction: "outbound", summary: "" });
    setMessage({ type: "info", text: "Đã ghi lịch sử liên hệ (local — chế độ demo)." });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.CUSTOMER_VIEW}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Lịch sử liên hệ
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Nhật ký tương tác với khách hàng theo CLB.
        </Typography>

        {runtime.mode === CRM_LEGACY_RUNTIME_MODE.UNAVAILABLE ? (
          <CrmLegacyUnavailableState
            message={runtime.userMessage}
            code={runtime.code}
            onRetry={retry}
          />
        ) : null}

        {runtime.mode === CRM_LEGACY_RUNTIME_MODE.MISSING_SCOPE ? (
          <CrmLegacyMissingClubState message={runtime.userMessage} />
        ) : null}

        {runtime.mode === CRM_LEGACY_RUNTIME_MODE.LEGACY_LOCAL ? (
          <>
            <CrmLegacyDemoBanner text={runtime.demoBanner} />

            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Ghi liên hệ thủ công
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Tên khách"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  fullWidth
                />
                <TextField
                  select
                  label="Kênh"
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  fullWidth
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Hướng"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="outbound">Đi ra</MenuItem>
                  <MenuItem value="inbound">Đến</MenuItem>
                </TextField>
                <TextField
                  label="Tóm tắt"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  fullWidth
                />
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                  Ghi nhận
                </Button>
              </Stack>
            </Card>

            <TableContainer component={Card} variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Thời gian</TableCell>
                    <TableCell>Khách</TableCell>
                    <TableCell>Kênh</TableCell>
                    <TableCell>Hướng</TableCell>
                    <TableCell>Tóm tắt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(historyResult.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography color="text.secondary">{CRM_LEGACY_EMPTY_HISTORY}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {(historyResult.items || []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.createdAt).toLocaleString("vi-VN")}</TableCell>
                      <TableCell>{entry.customerName}</TableCell>
                      <TableCell>{entry.channel}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={entry.direction === "inbound" ? "Đến" : "Đi ra"}
                          color={entry.direction === "inbound" ? "info" : "default"}
                        />
                      </TableCell>
                      <TableCell>{entry.summary}</TableCell>
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
