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
import { createTemplate, listTemplates } from "../services/crmTemplateService.js";

const CHANNEL_OPTIONS = [
  { value: "sms", label: "SMS" },
  { value: "zalo", label: "Zalo" },
  { value: "email", label: "Email" },
];

export default function CrmTemplatesPage() {
  const { activeClubId, revision } = useClub();
  const clubId = activeClubId || "demo-club";
  const [form, setForm] = useState({
    name: "",
    channel: "sms",
    subject: "",
    body: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const templates = useMemo(() => listTemplates(clubId), [clubId, revision, tick]);

  const handleCreate = () => {
    if (!form.name.trim() || !form.body.trim()) {
      setMessage({ type: "warning", text: "Nhập tên mẫu và nội dung." });
      return;
    }

    createTemplate(clubId, form);
    setForm({ name: "", channel: "sms", subject: "", body: "" });
    setMessage({ type: "success", text: "Đã lưu mẫu tin nhắn." });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.CUSTOMER_VIEW}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Mẫu tin nhắn
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Tạo mẫu tin nhắn tái sử dụng cho chiến dịch và nhắc booking.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Thêm mẫu
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Tên mẫu"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              helperText="Dùng {{ten_khach}}, {{gio_booking}} cho biến động."
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Lưu mẫu
            </Button>
          </Stack>
        </Card>

        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Kênh</TableCell>
                <TableCell>Tiêu đề</TableCell>
                <TableCell>Nội dung</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">Chưa có mẫu tin nhắn.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>{template.channel}</TableCell>
                  <TableCell>{template.subject || "—"}</TableCell>
                  <TableCell>{template.body.slice(0, 100)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </PermissionGate>
  );
}
