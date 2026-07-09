import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import { EVENT_TYPE } from "../../models/tournament/constants.js";
import {
  TournamentEntryEditor,
  TournamentGroupEditor,
  SuperAdminInterventionBanner,
} from "../../features/pairing-intervention/index.js";
import SelectPlayersResult from "../SelectPlayersResult.jsx";
import { swapTeamsInResult, movePlayerInResult } from "../selectPlayers.logic.js";
import {
  buildPreviewScheduleResult,
  buildPreviewTournamentData,
} from "./pairingInterventionPreviewData.js";

function BtcEntriesPanel({ entries }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        Cặp / đội đề xuất ({entries.length})
      </Typography>
      <Stack spacing={1} sx={{ maxHeight: 220, overflow: "auto" }}>
        {entries.map((entry) => (
          <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="body2" fontWeight="bold">
                {entry.name}
              </Typography>
              <Chip size="small" label={`Seed ${entry.seed || "-"}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Rating đội: {entry.rating}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

function BtcGroupsPanel({ groups }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        Bảng đấu ({groups.length})
      </Typography>
      <Stack spacing={1}>
        {groups.map((group) => (
          <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight="bold">{group.name}</Typography>
              <Chip
                size="small"
                label={`${group.entryIds?.length || 0} đội • ${group.matches?.length || 0} trận`}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {(group.entries || []).map((entry) => entry.name).join(" | ")}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

export default function PairingInterventionPreviewPage() {
  const [tab, setTab] = useState(0);
  const [founderView, setFounderView] = useState(true);
  const initial = useMemo(() => buildPreviewTournamentData(), []);
  const [entries, setEntries] = useState(initial.entries);
  const [groups, setGroups] = useState(initial.groups);
  const [scheduleResult, setScheduleResult] = useState(() => buildPreviewScheduleResult());

  const canIntervene = founderView;

  const handleEntryApply = (result) => {
    if (result?.entries) {
      setEntries(result.entries);
    }
  };

  const handleGroupApply = (result) => {
    if (result?.entries) {
      setEntries(result.entries);
    }
    if (result?.groups) {
      setGroups(result.groups);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <AdminPanelSettingsIcon color="warning" />
        <Typography variant="h5" fontWeight={800}>
          Super Admin — Preview can thiệp ghép cặp & chia bảng
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Route: /dev/pairing-intervention-preview — Dữ liệu mẫu, không cần giải thật.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={founderView}
              onChange={(event) => setFounderView(event.target.checked)}
              color="warning"
            />
          }
          label={
            founderView
              ? "Đang xem với tư cách Founder (panel can thiệp hiện)"
              : "Đang xem với tư cách BTC (panel can thiệp ẩn)"
          }
        />
      </Paper>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="1. Ghép cặp giải" />
        <Tab label="2. Chia bảng" />
        <Tab label="3. Xếp sân preview" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Panel BTC (chỉ xem)
            </Typography>
            <BtcEntriesPanel entries={entries} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Panel Founder
            </Typography>
            <TournamentEntryEditor
              entries={entries}
              players={initial.players}
              eventType={EVENT_TYPE.MIXED_DOUBLE}
              canIntervene={canIntervene && entries.length > 0}
              tournamentId="preview"
              eventId="preview-event"
              onApply={handleEntryApply}
            />
            {!canIntervene && (
              <Paper variant="outlined" sx={{ p: 2, mt: 1.5, bgcolor: "grey.50" }}>
                <Typography variant="body2" color="text.secondary">
                  User thường không thấy panel can thiệp ở đây.
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Panel BTC (chỉ xem)
            </Typography>
            <BtcGroupsPanel groups={groups} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Panel Founder
            </Typography>
            <TournamentGroupEditor
              groups={groups}
              entries={entries}
              players={initial.players}
              canIntervene={canIntervene && groups.length > 0}
              tournamentId="preview"
              eventId="preview-event"
              onApply={handleGroupApply}
            />
            {!canIntervene && (
              <Paper variant="outlined" sx={{ p: 2, mt: 1.5, bgcolor: "grey.50" }}>
                <Typography variant="body2" color="text.secondary">
                  User thường không thấy panel can thiệp chia bảng.
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Box>
          <SelectPlayersResult
            scheduleResult={scheduleResult}
            previewMode
            canIntervene={canIntervene}
            interventionBanner={
              canIntervene ? (
                <SuperAdminInterventionBanner message="Can thiệp xếp sân — đảo đội hoặc chuyển VĐV giữa đội A/B." />
              ) : null
            }
            onApplyPreview={() => {}}
            onCancelPreview={() => setScheduleResult(buildPreviewScheduleResult())}
            lockedCourts={[]}
            onToggleCourtLock={() => {}}
            onSwapTeams={(courtId) => {
              if (!canIntervene) return;
              setScheduleResult((prev) => swapTeamsInResult(prev, courtId));
            }}
            onMovePlayer={(courtId, fromTeam, playerId) => {
              if (!canIntervene) return;
              setScheduleResult((prev) => movePlayerInResult(prev, courtId, fromTeam, playerId));
            }}
            lockedPlayers={[]}
            onSelectAlternative={() => {}}
          />
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary">
        QA: Bật/tắt switch Founder để so sánh giao diện. Tab 1–2 dùng accordion thu gọn mặc định.
      </Typography>
    </Box>
  );
}
