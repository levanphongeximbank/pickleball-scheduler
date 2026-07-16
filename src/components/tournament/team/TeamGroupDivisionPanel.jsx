import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { TEAM_GROUP_SEEDING } from "../../../features/team-tournament/constants.js";
import {
  describeGroupSplit,
  recommendGroupSizes,
} from "../../../features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import { summarizeSeededGroupBalance } from "../../../features/team-tournament/engines/teamAutoDrawEngine.js";
import { runTeamDrawWithCanonicalAdapter } from "../../../features/competition-core/draw/adapters/teamDrawAdapter.js";
import {
  clearTeamGroups,
} from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../../../features/private-pairing-rules/index.js";

const MIN_TEAMS_FOR_GROUPS = 6;

const GROUP_SEEDING_OPTIONS = [
  {
    value: TEAM_GROUP_SEEDING.OFF,
    label: "Tắt hạt giống",
    description: "Chia bảng ngẫu nhiên, không xếp hạng hạt giống.",
  },
  {
    value: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL,
    label: "Ace + tổng điểm",
    description: "Ưu tiên VĐV mạnh nhất trong đội, tie-break theo tổng điểm đội.",
  },
  {
    value: TEAM_GROUP_SEEDING.AVG_LEVEL,
    label: "Trung bình đội",
    description: "Xếp hạt giống theo trung bình trình độ cả đội (chế độ cũ).",
  },
];

function getSeedingLabel(mode) {
  return GROUP_SEEDING_OPTIONS.find((option) => option.value === mode)?.label || mode;
}

export default function TeamGroupDivisionPanel({
  teamData,
  clubPlayers = [],
  canManage = false,
  clubId = "",
  tournamentId = "",
  tournament = null,
  tenantId = null,
  clubFromQuery = null,
  activeClubId = null,
  competitionClass = COMPETITION_CLASS.INTERNAL,
  onSave,
  onError,
  onMessage,
}) {
  const teams = teamData?.teams || [];
  const groups = teamData?.groups || [];
  const seedingMode = teamData?.settings?.groupSeeding || TEAM_GROUP_SEEDING.AVG_LEVEL;
  const seedingEnabled = seedingMode !== TEAM_GROUP_SEEDING.OFF;
  const useTopPlayerMode = seedingMode === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL;
  const [groupCount, setGroupCount] = useState(Math.max(2, groups.length || 2));
  const recommendedSizes = recommendGroupSizes(teams.length);
  const recommendedLabel = describeGroupSplit(teams.length);
  const balance = groups.length
    ? summarizeSeededGroupBalance(groups, teams, { seedingMode })
    : null;
  const selectedSeedingOption =
    GROUP_SEEDING_OPTIONS.find((option) => option.value === seedingMode) ||
    GROUP_SEEDING_OPTIONS[2];

  if (teams.length < MIN_TEAMS_FOR_GROUPS) {
    return null;
  }

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const teamById = new Map(teams.map((team) => [team.id, team]));

  function persistTeamData(nextTeamData, message) {
    onSave?.(nextTeamData);
    if (message) {
      onMessage?.(message);
    }
  }

  function handleSeedingModeChange(event) {
    if (!canManage) {
      return;
    }

    const nextMode = event.target.value;
    const nextTeamData = {
      ...teamData,
      settings: {
        ...teamData.settings,
        groupSeeding: nextMode,
      },
    };

    if (groups.length > 0 && nextMode !== seedingMode) {
      onMessage?.(
        `Đã đổi chế độ hạt giống sang "${getSeedingLabel(nextMode)}". Chia lại bảng để áp dụng.`
      );
    }

    persistTeamData(nextTeamData);
  }

  async function runGroupAssignment(options = {}) {
    const prepared = await prepareLivePrivatePairingOptions({
      tournament: tournament || null,
      clubId: clubId || tournament?.clubId || null,
      clubFromQuery,
      activeClubId,
      tournamentId: tournamentId || tournament?.id || null,
      tenantId:
        tenantId ||
        tournament?.tenantId ||
        teamData?.settings?.tenantId ||
        null,
      eventId: tournamentId ? `event-${tournamentId}` : null,
      competitionClass,
      allowedByPublishedRules: competitionClass === COMPETITION_CLASS.OFFICIAL ? false : undefined,
    });

    if (!prepared.ok) {
      onError?.(prepared.error?.message || "Không chia được bảng theo quy tắc riêng.");
      return null;
    }

    const {
      ok,
      teamData: next,
      balance: nextBalance,
      warnings = [],
      privatePairingError,
    } = runTeamDrawWithCanonicalAdapter({
      teamData,
      players: clubPlayers,
      seedingMode,
      groupCount: options.groupCount,
      randomFn: options.randomFn,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      competitionClass:
        prepared.pairingOptions?.competitionClass || competitionClass,
      clubId: clubId || null,
      tournamentId: tournamentId || null,
      eventId: tournamentId ? `event-${tournamentId}` : null,
    });

    if (ok === false || privatePairingError) {
      onError?.(
        privatePairingError?.message || "Không chia được bảng theo quy tắc riêng."
      );
      return null;
    }

    if (!next?.groups?.length) {
      onError?.("Không chia được bảng.");
      return null;
    }

    if (warnings.length) {
      onMessage?.(warnings.join(" "));
    }

    return { next, nextBalance };
  }

  async function handleAutoAssignGroups() {
    if (!canManage) {
      return;
    }

    const result = await runGroupAssignment();
    if (!result) {
      return;
    }

    const { next, nextBalance } = result;
    const label = recommendedLabel || `${next.groups.length} bảng`;
    const balanceLabel = nextBalance?.balanced ? "cân bằng" : "lệch nhẹ";
    const modeLabel = getSeedingLabel(seedingMode);
    persistTeamData(
      next,
      seedingEnabled
        ? `Đã chia bảng (${modeLabel}): ${label} (${balanceLabel}).`
        : `Đã chia bảng ngẫu nhiên: ${label} (${balanceLabel}).`
    );
  }

  async function handleAssignGroups() {
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

    const result = await runGroupAssignment({ groupCount });
    if (!result) {
      return;
    }

    persistTeamData(result.next, `Đã chia ${groupCount} bảng (${getSeedingLabel(seedingMode)}).`);
  }

  function handleClearGroups() {
    if (!canManage) {
      return;
    }
    persistTeamData(clearTeamGroups(teamData), "Đã xóa chia bảng.");
  }

  function formatTeamSeedLine(teamId) {
    const team = teamById.get(teamId);
    if (!team || !seedingEnabled || !team.seed) {
      return teamNameById.get(teamId) || teamId;
    }

    if (useTopPlayerMode && team.topPlayerRating > 0) {
      return `${teamNameById.get(teamId) || teamId} (Seed ${team.seed} · Ace ${team.topPlayerRating} · Tổng ${team.totalRating || "—"})`;
    }

    return `${teamNameById.get(teamId) || teamId} (Seed ${team.seed} · TB ${team.avgLevel || "—"})`;
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
          {" "}
          {selectedSeedingOption.description}
        </Alert>

        {canManage ? (
          <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
            <InputLabel>Chế độ hạt giống</InputLabel>
            <Select
              label="Chế độ hạt giống"
              value={seedingMode}
              onChange={handleSeedingModeChange}
            >
              {GROUP_SEEDING_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Chip size="small" variant="outlined" label={`Hạt giống: ${getSeedingLabel(seedingMode)}`} />
        )}

        {canManage ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
            {recommendedSizes || teams.length >= 6 ? (
              <Button variant="contained" onClick={handleAutoAssignGroups}>
                {seedingEnabled ? "Chia bảng tự động (hạt giống)" : "Chia bảng ngẫu nhiên"}
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
                label={
                  useTopPlayerMode
                    ? `${group.groupName}: Ace TB ${group.topAvg}`
                    : `${group.groupName}: TB ${group.avgLevel}`
                }
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
                  {group.teamIds.map((teamId) => formatTeamSeedLine(teamId)).join(" · ") ||
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
