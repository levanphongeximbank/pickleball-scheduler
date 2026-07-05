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
import { addContactHistory } from "../services/crmContactHistoryService.js";
import {
  createMessage,
  listMessages,
  markMessageSent,
} from "../services/crmMessageService.js";

const CHANNEL_OPTIONS = [
  { value: "sms", label: "SMS" },
  { value: "zalo", label: "Zalo" },
  { value: "email", label: "Email" },
];

const STATUS_LABELS = {
  draft: "Nháp",
  sent: "Đã gửi",
  failed: "Lỗi",
};

export default function CrmMessagesPage() {
  const { activeClubId, revision } = useClub();
  const clubId = activeClubId || "demo-club";
  const [form, setForm] = useState({
    recipientName: "",
    channel: "sms",
    subject: "",
    body: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const messages = useMemo(() => listMessages(clubId), [clubId, revision, tick]);

  const handleCreate = (sendNow = false) => {
    if (!form.recipientName.trim() || !form.body.trim()) {
      setMessage({ type: "warning", text: "Nhập người nhận và nội dung tin nhắn." });
      return;
    }

    const created = createMessage(clubId, { ...form, sendNow });
    if (sendNow) {
      addContactHistory(clubId, {
        customerName: created.recipientName,
        channel: created.channel,
        direction: "outbound",
        summary: created.body.slice(0, 120),
        relatedMessageId: created.id,
      });
    }

    setForm({ recipientName: "", channel: "sms", subject: "", body: "" });
    setMessage({
      type: "success",
      text: sendNow ? "Đã gửi tin nhắn (mock)." : "Đã lưu bản nháp.",
    });
    setTick((value) => value + 1);
  };

  const handleSendDraft = (messageId, row) => {
    markMessageSent(clubId, messageId);
    addContactHistory(clubId, {
      customerName: row.recipientName,
      channel: row.channel,
      direction: "outbound",
      summary: row.body.slice(0, 120),
      relatedMessageId: messageId,
    });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permissions={[PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW]}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Tin nhắn
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Soạn và gửi tin nhắn tới khách hàng (lưu local theo CLB).
        </Typography>

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
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleCreate(false)}>
                Lưu nháp
              </Button>
              <Button variant="contained" startIcon={<SendIcon />} onClick={() => handleCreate(true)}>
                Gửi ngay
              </Button>
            </Stack>
          </Stack>
        </Card>

        <TableContainer component={Card} variant="outlined">
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
              {messages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">Chưa có tin nhắn.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {messages.map((row) => (
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
                        Gửi
                      </Button>
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
