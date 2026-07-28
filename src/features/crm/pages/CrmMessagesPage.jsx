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
import SendIcon from "@mui/icons-material/Send";

import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { useClub } from "../../../context/ClubContext.jsx";
import {
  CRM_LEGACY_EMPTY_MESSAGES,
  CRM_LEGACY_RUNTIME_MODE,
  CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
} from "../runtime/constants.js";
import {
  CrmLegacyDemoBanner,
  CrmLegacyMissingClubState,
  CrmLegacyUnavailableState,
} from "../runtime/CrmLegacyStateViews.jsx";
import { useCrmLegacyRuntime } from "../runtime/useCrmLegacyRuntime.js";
import { addContactHistory } from "../services/crmContactHistoryService.js";
import {
  createMessage,
  listMessagesResult,
  markMessageSent,
} from "../services/crmMessageService.js";

const CHANNEL_OPTIONS = [
  { value: "sms", label: "SMS" },
  { value: "zalo", label: "Zalo" },
  { value: "email", label: "Email" },
];

const STATUS_LABELS = {
  draft: "Nháp",
  sent: "Đã gửi (local)",
  failed: "Lỗi",
};

export default function CrmMessagesPage() {
  const { activeClubId, revision } = useClub();
  const { runtime, retry } = useCrmLegacyRuntime(activeClubId);
  const [form, setForm] = useState({
    recipientName: "",
    channel: "sms",
    subject: "",
    body: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const clubId = runtime.clubId;
  const messagesResult = useMemo(
    () =>
      runtime.mode === CRM_LEGACY_RUNTIME_MODE.LEGACY_LOCAL
        ? listMessagesResult(clubId)
        : { ok: true, items: [] },
    [clubId, revision, tick, runtime.mode]
  );

  const handleCreate = (sendNow = false) => {
    if (!runtime.allowsWrites || !clubId) {
      setMessage({
        type: "warning",
        text: runtime.userMessage || CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    if (!form.recipientName.trim() || !form.body.trim()) {
      setMessage({ type: "warning", text: "Nhập người nhận và nội dung tin nhắn." });
      return;
    }

    const created = createMessage(clubId, { ...form, sendNow });
    if (!created?.ok) {
      setMessage({
        type: "error",
        text: created?.error || CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }

    if (sendNow) {
      addContactHistory(clubId, {
        customerName: created.data.recipientName,
        channel: created.data.channel,
        direction: "outbound",
        summary: created.data.body.slice(0, 120),
        relatedMessageId: created.data.id,
      });
    }

    setForm({ recipientName: "", channel: "sms", subject: "", body: "" });
    setMessage({
      type: "info",
      text: sendNow
        ? "Đã lưu trạng thái gửi local (demo) — chưa gửi qua kênh CRM nền tảng."
        : "Đã lưu bản nháp (local — chế độ demo).",
    });
    setTick((value) => value + 1);
  };

  const handleSendDraft = (messageId, row) => {
    if (!runtime.allowsWrites || !clubId) {
      setMessage({
        type: "warning",
        text: runtime.userMessage || CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    const sent = markMessageSent(clubId, messageId);
    if (!sent?.ok) {
      setMessage({
        type: "error",
        text: sent?.error || CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      });
      return;
    }
    addContactHistory(clubId, {
      customerName: row.recipientName,
      channel: row.channel,
      direction: "outbound",
      summary: row.body.slice(0, 120),
      relatedMessageId: messageId,
    });
    setMessage({
      type: "info",
      text: "Đã đánh dấu gửi local (demo) — chưa gửi qua kênh CRM nền tảng.",
    });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permissions={[PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW]}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Tin nhắn
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Soạn và quản lý tin nhắn khách hàng theo CLB.
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
                Soạn tin nhắn
              </Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Người nhận"
                    value={form.recipientName}
                    onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
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
                    label="Tiêu đề"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Nội dung"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  multiline
                  minRows={3}
                  fullWidth
                />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleCreate(false)}>
                    Lưu nháp
                  </Button>
                  <Button variant="contained" startIcon={<SendIcon />} onClick={() => handleCreate(true)}>
                    Ghi gửi (demo)
                  </Button>
                </Stack>
              </Stack>
            </Card>

            <TableContainer component={Card} variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Thời gian</TableCell>
                    <TableCell>Người nhận</TableCell>
                    <TableCell>Kênh</TableCell>
                    <TableCell>Nội dung</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(messagesResult.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">{CRM_LEGACY_EMPTY_MESSAGES}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {(messagesResult.items || []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.createdAt).toLocaleString("vi-VN")}</TableCell>
                      <TableCell>{row.recipientName}</TableCell>
                      <TableCell>{row.channel}</TableCell>
                      <TableCell>{row.body.slice(0, 80)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={STATUS_LABELS[row.status] || row.status} />
                      </TableCell>
                      <TableCell align="right">
                        {row.status === "draft" && (
                          <Button size="small" onClick={() => handleSendDraft(row.id, row)}>
                            Ghi gửi (demo)
                          </Button>
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
