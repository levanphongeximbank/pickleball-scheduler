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
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { useClub } from "../../../context/ClubContext.jsx";
import { createCampaign, launchCampaign, listCampaigns } from "../services/crmCampaignService.js";
import { listTemplates } from "../services/crmTemplateService.js";

const STATUS_LABELS = {
  draft: "Nháp",
  scheduled: "Đã lên lịch",
  running: "Đang chạy",
  completed: "Hoàn tất",
};

const TARGET_OPTIONS = [
  { value: "all", label: "Tất cả khách" },
  { value: "members", label: "Hội viên" },
  { value: "debt", label: "Khách còn nợ" },
  { value: "inactive", label: "Khách không hoạt động" },
];

export default function CrmCampaignsPage() {
  const { activeClubId, revision } = useClub();
  const clubId = activeClubId || "demo-club";
  const [form, setForm] = useState({
    name: "",
    templateId: "",
    targetGroup: "all",
    scheduledAt: "",
  });
  const [message, setMessage] = useState(null);
  const [tick, setTick] = useState(0);

  const campaigns = useMemo(() => listCampaigns(clubId), [clubId, revision, tick]);
  const templates = useMemo(() => listTemplates(clubId), [clubId, revision, tick]);

  const handleCreate = () => {
    if (!form.name.trim()) {
      setMessage({ type: "warning", text: "Nhập tên chiến dịch." });
      return;
    }

    createCampaign(clubId, {
      ...form,
      scheduledAt: form.scheduledAt || null,
    });
    setForm({ name: "", templateId: "", targetGroup: "all", scheduledAt: "" });
    setMessage({ type: "success", text: "Đã tạo chiến dịch." });
    setTick((value) => value + 1);
  };

  const handleLaunch = (campaignId) => {
    launchCampaign(clubId, campaignId, { sentCount: 1 });
    setMessage({ type: "success", text: "Đã chạy chiến dịch (mock)." });
    setTick((value) => value + 1);
  };

  return (
    <PermissionGate permission={PERMISSIONS.CUSTOMER_VIEW}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Chiến dịch
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Gửi hàng loạt theo mẫu tin nhắn và nhóm khách mục tiêu.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Tạo chiến dịch
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Tên chiến dịch"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Mẫu tin"
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              fullWidth
            >
              <MenuItem value="">Không chọn mẫu</MenuItem>
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Nhóm mục tiêu"
              value={form.targetGroup}
              onChange={(e) => setForm({ ...form, targetGroup: e.target.value })}
              fullWidth
            >
              {TARGET_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Lên lịch"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              InputLabelProps={{ shrink: true }}
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
                <TableCell>Tên</TableCell>
                <TableCell>Nhóm</TableCell>
                <TableCell>Lịch gửi</TableCell>
                <TableCell>Đã gửi</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">Chưa có chiến dịch.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>{campaign.name}</TableCell>
                  <TableCell>{campaign.targetGroup}</TableCell>
                  <TableCell>
                    {campaign.scheduledAt
                      ? new Date(campaign.scheduledAt).toLocaleString("vi-VN")
                      : "—"}
                  </TableCell>
                  <TableCell>{campaign.sentCount}</TableCell>
                  <TableCell>
                    <Chip size="small" label={STATUS_LABELS[campaign.status] || campaign.status} />
                  </TableCell>
                  <TableCell align="right">
                    {campaign.status !== "completed" && (
                      <Button
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => handleLaunch(campaign.id)}
                      >
                        Chạy
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
