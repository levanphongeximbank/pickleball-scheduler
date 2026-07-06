import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import TournamentPageHeader from "../components/tournament/TournamentPageHeader.jsx";
import TournamentSectionCard from "../components/tournament/TournamentSectionCard.jsx";
import { TOURNAMENT_LAYOUT } from "../components/tournament/tournamentLayout.js";
import {
  approveSkillLevelProposal,
  ensureMonthlySkillLevelProposals,
  generateMonthlySkillLevelProposals,
  getSkillLevelOverview,
  getSkillLevelRules,
  listSkillLevelProposals,
  rejectSkillLevelProposal,
  updateSkillLevelRules,
} from "../domain/skillLevelService.js";
import { PROPOSAL_STATUS } from "../tournament/engines/skillLevelEngine.js";
import { getLevelColor, getLevelLabel } from "../utils/playerHelpers.js";

const HISTORY_TABS = [
  { key: "approved", label: "Đã duyệt", status: PROPOSAL_STATUS.APPROVED },
  { key: "rejected", label: "Đã từ chối", status: PROPOSAL_STATUS.REJECTED },
];

function KpiCard({ label, value, hint }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        height: "100%",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} lineHeight={1.2}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function formatReviewDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

export default function SkillLevelsPage() {
  const { activeClubId, activeClub, revision, refreshClubs } = useClub();
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const canManage =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.PLAYER_UPDATE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    });

  const [message, setMessage] = useState(null);
  const [historyTab, setHistoryTab] = useState("approved");
  const [rulesForm, setRulesForm] = useState(() => getSkillLevelRules(activeClubId));

  useEffect(() => {
    if (!activeClubId) return;
    setRulesForm(getSkillLevelRules(activeClubId));
  }, [activeClubId, revision]);

  useEffect(() => {
    if (!activeClubId) return;

    const result = ensureMonthlySkillLevelProposals(activeClubId);
    if (!result.ok || result.skipped || !result.proposalCount) {
      return;
    }

    setMessage({
      type: "info",
      text: `Hệ thống đã tự tạo ${result.proposalCount} đề xuất đổi trình. Duyệt bên dưới để áp dụng.`,
    });
  }, [activeClubId]);

  const overview = useMemo(() => {
    void revision;
    return getSkillLevelOverview(activeClubId);
  }, [activeClubId, revision]);

  const pendingProposals = useMemo(() => {
    void revision;
    return listSkillLevelProposals(activeClubId, { status: PROPOSAL_STATUS.PENDING });
  }, [activeClubId, revision]);

  const historyProposals = useMemo(() => {
    void revision;
    const status =
      HISTORY_TABS.find((tab) => tab.key === historyTab)?.status || PROPOSAL_STATUS.APPROVED;
    return listSkillLevelProposals(activeClubId, { status });
  }, [activeClubId, revision, historyTab]);

  const handleApprove = (proposalId) => {
    const result = approveSkillLevelProposal(activeClubId, proposalId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không thể duyệt." });
      return;
    }
    refreshClubs();
    setMessage({ type: "success", text: "Đã duyệt và cập nhật trình công khai." });
  };

  const handleReject = (proposalId) => {
    const result = rejectSkillLevelProposal(activeClubId, proposalId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không thể từ chối." });
      return;
    }
    refreshClubs();
    setMessage({ type: "info", text: "Đã từ chối đề xuất. Trình công khai giữ nguyên." });
  };

  const handleGenerate = () => {
    const result = generateMonthlySkillLevelProposals(activeClubId, { force: true });
    if (!result.ok) {
      setMessage({ type: "error", text: "Không thể tạo đề xuất." });
      return;
    }
    if (result.skipped) {
      setMessage({ type: "info", text: "Không có VĐV nào cần đề xuất trong tháng này." });
      return;
    }
    refreshClubs();
    setMessage({
      type: "success",
      text: `Đã tạo ${result.proposalCount || 0} đề xuất mới.`,
    });
  };

  const handleSaveRules = () => {
    const result = updateSkillLevelRules(activeClubId, rulesForm);
    if (!result.ok) {
      setMessage({ type: "error", text: "Không thể lưu cấu hình." });
      return;
    }
    refreshClubs();
    setMessage({ type: "success", text: "Đã lưu quy tắc chốt trình." });
  };

  const updateRule = (field, value) => {
    setRulesForm((current) => ({ ...current, [field]: value }));
  };

  const contextLine = activeClub?.name ? `CLB ${activeClub.name}` : undefined;

  const headerActions = (
    <PermissionGate permission={PERMISSIONS.PLAYER_UPDATE}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleGenerate}>
          Tạo đề xuất tháng này
        </Button>
      </Stack>
    </PermissionGate>
  );

  return (
    <Box>
      <TournamentPageHeader
        title="Điểm trình độ"
        description="Phân bố hạng VĐV, duyệt đề xuất đổi trình công khai và cấu hình quy tắc chốt tháng."
        contextLine={contextLine}
        badge={`Tháng ${overview.reviewMonth}`}
        badgeColor="info"
        action={headerActions}
      />

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing} sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Tổng VĐV" value={overview.totalPlayers} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard
            label="Level trung bình"
            value={overview.averageLevel.toFixed(1)}
            hint={getLevelLabel(overview.averageLevel)}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Đề xuất chờ duyệt" value={overview.pendingCount} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard
            label="Chốt trình"
            value={overview.rules.enabled ? "Bật" : "Tắt"}
            hint={overview.rules.autoGenerateProposals ? "Tự động" : "Thủ công"}
          />
        </Grid>
      </Grid>

      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing} sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <TournamentSectionCard title="Phân bố level VĐV">
            {overview.distribution.every((row) => row.count === 0) ? (
              <Typography color="text.secondary">Chưa có dữ liệu VĐV.</Typography>
            ) : (
              <Box sx={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={overview.distribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Số VĐV" fill="#157347" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </TournamentSectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <TournamentSectionCard title="Cấu hình quy tắc">
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(rulesForm.enabled)}
                    onChange={(e) => updateRule("enabled", e.target.checked)}
                    disabled={!canManage}
                  />
                }
                label="Bật chốt trình hàng tháng"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(rulesForm.autoGenerateProposals)}
                    onChange={(e) => updateRule("autoGenerateProposals", e.target.checked)}
                    disabled={!canManage}
                  />
                }
                label="Tự tạo đề xuất khi đến kỳ"
              />
              <TextField
                select
                label="Bước nhảy level"
                size="small"
                value={rulesForm.step}
                onChange={(e) => updateRule("step", Number(e.target.value))}
                disabled={!canManage}
                fullWidth
              >
                {[0.5, 1].map((step) => (
                  <MenuItem key={step} value={step}>
                    {step.toFixed(1)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Ngưỡng thăng hạng"
                type="number"
                size="small"
                inputProps={{ step: 0.05, min: 0.1, max: 2 }}
                value={rulesForm.promoteThreshold}
                onChange={(e) => updateRule("promoteThreshold", Number(e.target.value))}
                disabled={!canManage}
                fullWidth
              />
              <TextField
                label="Ngưỡng hạ hạng"
                type="number"
                size="small"
                inputProps={{ step: 0.05, min: 0.1, max: 2 }}
                value={rulesForm.demoteThreshold}
                onChange={(e) => updateRule("demoteThreshold", Number(e.target.value))}
                disabled={!canManage}
                fullWidth
              />
              {canManage && (
                <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveRules}>
                  Lưu cấu hình
                </Button>
              )}
            </Stack>
          </TournamentSectionCard>
        </Grid>
      </Grid>

      <TournamentSectionCard
        title={`Hàng đợi duyệt (${pendingProposals.length})`}
        sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}
      >
        {pendingProposals.length === 0 ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiEventsIcon color="disabled" fontSize="small" />
            <Typography color="text.secondary">Không có đề xuất đang chờ.</Typography>
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>VĐV</TableCell>
                  <TableCell>Thay đổi</TableCell>
                  <TableCell>Rating nội bộ</TableCell>
                  <TableCell>Tháng</TableCell>
                  {canManage && <TableCell align="right">Thao tác</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingProposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell>{proposal.playerName || `VĐV #${proposal.playerId}`}</TableCell>
                    <TableCell>
                      {Number(proposal.currentLevel).toFixed(1)} →{" "}
                      <strong>{Number(proposal.proposedLevel).toFixed(1)}</strong>
                    </TableCell>
                    <TableCell>{Number(proposal.ratingInternal).toFixed(2)}</TableCell>
                    <TableCell>{proposal.reviewMonth}</TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="contained" onClick={() => handleApprove(proposal.id)}>
                            Duyệt
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => handleReject(proposal.id)}>
                            Từ chối
                          </Button>
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TournamentSectionCard>

      <TournamentSectionCard
        title="Bảng trình độ VĐV"
        sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}
      >
        {overview.players.length === 0 ? (
          <Typography color="text.secondary">
            Chưa có VĐV.{" "}
            <Button component={RouterLink} to="/players" size="small">
              Thêm tại trang Vận động viên
            </Button>
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Họ tên</TableCell>
                  <TableCell>Trình công khai</TableCell>
                  <TableCell>Rating nội bộ</TableCell>
                  <TableCell>Chênh lệch</TableCell>
                  <TableCell>Lần chốt gần nhất</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.players.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Button
                        component={RouterLink}
                        to={`/players/profile/${row.id}`}
                        size="small"
                        sx={{ textTransform: "none", fontWeight: 600, p: 0, minWidth: 0 }}
                      >
                        {row.name}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={`${row.publicLevel.toFixed(1)} · ${getLevelLabel(row.publicLevel)}`}
                        sx={{
                          bgcolor: `${getLevelColor(row.publicLevel)}18`,
                          color: getLevelColor(row.publicLevel),
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.ratingInternal.toFixed(2)}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={row.delta > 0 ? "success.main" : row.delta < 0 ? "error.main" : "text.secondary"}
                        fontWeight={600}
                      >
                        {row.delta > 0 ? "+" : ""}
                        {row.delta.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatReviewDate(row.lastReviewAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TournamentSectionCard>

      <TournamentSectionCard title="Lịch sử đề xuất">
        <Tabs
          value={historyTab}
          onChange={(_, value) => setHistoryTab(value)}
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          {HISTORY_TABS.map((tab) => (
            <Tab key={tab.key} value={tab.key} label={tab.label} />
          ))}
        </Tabs>

        {historyProposals.length === 0 ? (
          <Typography color="text.secondary">Chưa có bản ghi.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>VĐV</TableCell>
                  <TableCell>Thay đổi</TableCell>
                  <TableCell>Tháng</TableCell>
                  <TableCell>Xử lý lúc</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyProposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell>{proposal.playerName || `VĐV #${proposal.playerId}`}</TableCell>
                    <TableCell>
                      {Number(proposal.currentLevel).toFixed(1)} →{" "}
                      {Number(proposal.proposedLevel).toFixed(1)}
                    </TableCell>
                    <TableCell>{proposal.reviewMonth}</TableCell>
                    <TableCell>{formatReviewDate(proposal.reviewedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TournamentSectionCard>
    </Box>
  );
}
