import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  describeGroupSplit,
  recommendGroupSizes,
} from "../../../features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import {
  assignSeededTeamsToGroups,
  summarizeSeededGroupBalance,
} from "../../../features/team-tournament/engines/teamAutoDrawEngine.js";
import {
  clearTeamGroups,
} from "../../../features/team-tournament/engines/teamTournamentEngine.js";

const MIN_TEAMS_FOR_GROUPS = 6;

export default function TeamGroupDivisionPanel({
  teamData,
  canManage = false,
  onSave,
  onError,
  onMessage,
}) {
  const teams = teamData?.teams || [];
  const groups = teamData?.groups || [];
  const [groupCount, setGroupCount] = useState(Math.max(2, groups.length || 2));
  const recommendedSizes = recommendGroupSizes(teams.length);
  const recommendedLabel = describeGroupSplit(teams.length);
  const balance = groups.length
    ? summarizeSeededGroupBalance(groups, teams)
    : null;

  if (teams.length < MIN_TEAMS_FOR_GROUPS) {
    return null;
  }

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  function handleAutoAssignGroups() {
    if (!canManage) {
      return;
    }

    const { teamData: next, balance: nextBalance } = assignSeededTeamsToGroups(teamData);
    if (!next.groups?.length) {
      onError?.("Không chia được bảng.");
      return;
    }

    onSave?.(next);
    const label = recommendedLabel || `${next.groups.length} bảng`;
    const balanceLabel = nextBalance?.balanced ? "cân bằng" : "lệch nhẹ";
    onMessage?.(`Đã chia bảng có hạt giống: ${label} (${balanceLabel}).`);
  }

  function handleAssignGroups() {
    if (!canManage) {
      return;
    }
    if (groupCount < 2) {
      onError?.("Cần ít nhất 2 bảng.");
      return;
    }
    if (groupCount > teams.length) {
      onError?.("Số bảng không được lớn hơn số đội.");
      return;
    }

    const { teamData: next } = assignSeededTeamsToGroups(teamData, { groupCount });
    onSave?.(next);
    onMessage?.(`Đã chia ${groupCount} bảng theo hạt giống.`);
  }

  function handleClearGroups() {
    if (!canManage) {
      return;
    }
    onSave?.(clearTeamGroups(teamData));
    onMessage?.("Đã xóa chia bảng.");
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Chia bảng đấu
          </Typography>
          <Chip size="small" label={`${teams.length} đội`} />
        </Stack>

        <Alert severity="info">
          Giải từ {MIN_TEAMS_FOR_GROUPS} đội trở lên cần chia 2 bảng trước khi tạo lịch.
          {recommendedLabel ? ` Gợi ý: ${recommendedLabel}.` : ""}
          {" "}Chia bảng tự động xét hạt giống theo trình độ đội.
        </Alert>

        {canManage ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
            {recommendedSizes || teams.length >= 6 ? (
              <Button variant="contained" onClick={handleAutoAssignGroups}>
                Chia bảng tự động (hạt giống)
              </Button>
            ) : null}
            <TextField
              size="small"
              type="number"
              label="Số bảng (thủ công)"
              value={groupCount}
              inputProps={{ min: 2, max: teams.length }}
              onChange={(event) => setGroupCount(Number(event.target.value) || 2)}
              sx={{ width: { xs: "100%", sm: 160 } }}
            />
            <Button variant="outlined" onClick={handleAssignGroups}>
              Chia bảng thủ công
            </Button>
            {groups.length > 0 ? (
              <Button variant="outlined" color="warning" onClick={handleClearGroups}>
                Xóa chia bảng
              </Button>
            ) : null}
          </Stack>
        ) : null}

        {balance?.groups?.length ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {balance.groups.map((group) => (
              <Chip
                key={group.groupId}
                size="small"
                variant="outlined"
                label={`${group.groupName}: TB ${group.avgLevel}`}
              />
            ))}
            <Chip
              size="small"
              color={balance.balanced ? "success" : "warning"}
              label={balance.balanced ? "Cân bằng" : `Lệch ${balance.spread}`}
            />
          </Stack>
        ) : null}

        {groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa chia bảng. Bấm &quot;Chia bảng tự động&quot; hoặc chọn số bảng rồi chia thủ công.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {groups.map((group) => (
              <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography fontWeight="bold">{group.name}</Typography>
                  <Chip size="small" label={`${group.teamIds.length} đội`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {group.teamIds.map((teamId) => teamNameById.get(teamId) || teamId).join(" · ") ||
                    "Chưa có đội"}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
