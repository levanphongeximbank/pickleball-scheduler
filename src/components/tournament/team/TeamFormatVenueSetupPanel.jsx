import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  FORMAT_PRESET,
  GROUP_MODE,
  KNOCKOUT_FORMAT,
} from "../../../features/team-tournament/constants.js";
import {
  applyMlp4Preset,
  assertCourtsReadyForPublish,
  isFormatVenueSetupComplete,
  mergeFormatVenueIntoSettings,
  recommendAutomaticGroupCount,
  resolveFormatVenueDefaults,
  validateRosterRules,
} from "../../../features/team-tournament/engines/teamFormatVenueConfig.js";
import { isSetupMutationFoundationEnabled } from "../../../features/team-tournament/setup/setupMutationFeatureGate.js";
import { loadCourtsForClub } from "../../../domain/clubStorage.js";
import { getCourtDisplayName } from "../../../pages/courts.logic.js";

const GROUP_SETUP_CHOICES = [
  { value: "1", label: "1 bảng", groupMode: GROUP_MODE.SINGLE_POOL, groupCount: 1 },
  { value: "2", label: "2 bảng", groupMode: GROUP_MODE.MANUAL, groupCount: 2 },
  { value: "auto", label: "Tự động", groupMode: GROUP_MODE.AUTOMATIC, groupCount: null },
  { value: "custom", label: "Tùy chỉnh", groupMode: GROUP_MODE.MANUAL, groupCount: null },
];

function resolveGroupSetupValue(config) {
  if (config.groupMode === GROUP_MODE.AUTOMATIC) return "auto";
  if (config.groupCount === 1 && (config.groupMode === GROUP_MODE.SINGLE_POOL || config.groupMode === GROUP_MODE.NONE)) {
    return "1";
  }
  if (config.groupCount === 2 && config.groupMode !== GROUP_MODE.AUTOMATIC) return "2";
  return "custom";
}

export default function TeamFormatVenueSetupPanel({
  teamData,
  tournament = null,
  clubId = "",
  canManage = false,
  teamCountHint = 0,
  onSave,
  onError,
  onMessage,
}) {
  const gateOn = isSetupMutationFoundationEnabled();
  const defaults = useMemo(
    () => resolveFormatVenueDefaults(teamData, tournament),
    [teamData, tournament]
  );

  const venueCourts = useMemo(() => {
    const courts = loadCourtsForClub(clubId || tournament?.clubId || "");
    return (courts || []).filter((court) => court.active !== false);
  }, [clubId, tournament?.clubId]);

  const [formatPreset, setFormatPreset] = useState(defaults.formatPreset);
  const [rosterRules, setRosterRules] = useState(defaults.rosterRules);
  const [dreambreakerEnabled, setDreambreakerEnabled] = useState(
    defaults.dreambreakerEnabled
  );
  const [groupSetup, setGroupSetup] = useState(resolveGroupSetupValue(defaults));
  const [groupCount, setGroupCount] = useState(defaults.groupCount || 1);
  const [qualificationCount, setQualificationCount] = useState(
    defaults.qualificationCount || 2
  );
  const [knockoutFormat, setKnockoutFormat] = useState(defaults.knockoutFormat);
  const [selectedCourtIds, setSelectedCourtIds] = useState(defaults.selectedCourtIds || []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = resolveFormatVenueDefaults(teamData, tournament);
    setFormatPreset(next.formatPreset);
    setRosterRules(next.rosterRules);
    setDreambreakerEnabled(next.dreambreakerEnabled);
    setGroupSetup(resolveGroupSetupValue(next));
    setGroupCount(next.groupCount || 1);
    setQualificationCount(next.qualificationCount || 2);
    setKnockoutFormat(next.knockoutFormat);
    setSelectedCourtIds(next.selectedCourtIds || []);
  }, [teamData, tournament]);

  const complete = isFormatVenueSetupComplete(
    {
      ...teamData,
      settings: mergeFormatVenueIntoSettings(teamData?.settings || {}, {
        formatPreset,
        rosterRules,
        dreambreakerEnabled,
        groupCount,
        qualificationCount,
        knockoutFormat,
        selectedCourtIds,
      }),
    },
    tournament
  );

  const courtPublishGate = assertCourtsReadyForPublish({ selectedCourtIds });

  function handleFormatChange(nextPreset) {
    setFormatPreset(nextPreset);
    if (nextPreset === FORMAT_PRESET.MLP_4) {
      const mlp = applyMlp4Preset();
      setRosterRules(mlp.rosterRules);
      setDreambreakerEnabled(true);
    }
  }

  function handleGroupSetupChange(value) {
    setGroupSetup(value);
    const choice = GROUP_SETUP_CHOICES.find((item) => item.value === value);
    if (!choice) return;
    if (value === "auto") {
      const recommended = recommendAutomaticGroupCount(
        teamCountHint || teamData?.teams?.length || 4
      );
      setGroupCount(recommended);
    } else if (choice.groupCount != null) {
      setGroupCount(choice.groupCount);
    }
  }

  function toggleCourt(courtId) {
    const id = String(courtId);
    setSelectedCourtIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAllCourts() {
    setSelectedCourtIds(venueCourts.map((court) => String(court.id)));
  }

  function clearCourts() {
    setSelectedCourtIds([]);
  }

  async function handleSave() {
    if (!canManage) return;

    if (!gateOn) {
      onError?.(
        "Không thể lưu Format & Venue lên cloud: Setup mutation v7 đang tắt (VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7). Không hứa hẹn ghi đám mây khi gate OFF."
      );
      return;
    }

    const rosterCheck = validateRosterRules(rosterRules);
    if (!rosterCheck.ok) {
      onError?.(rosterCheck.error);
      return;
    }

    const choice = GROUP_SETUP_CHOICES.find((item) => item.value === groupSetup);
    const resolvedGroupMode =
      choice?.groupMode ||
      (groupCount === 1 ? GROUP_MODE.SINGLE_POOL : GROUP_MODE.MANUAL);
    const resolvedGroupCount = Math.max(1, Number(groupCount) || 1);

    const config = {
      formatPreset,
      rosterRules: rosterCheck.rosterRules,
      dreambreakerEnabled,
      groupMode: resolvedGroupMode,
      groupCount: resolvedGroupCount,
      qualificationCount: Math.max(1, Number(qualificationCount) || 1),
      knockoutFormat,
      selectedCourtIds,
      teamsPerGroup:
        resolvedGroupCount > 0
          ? Math.ceil((teamCountHint || teamData?.teams?.length || 0) / resolvedGroupCount) || null
          : null,
    };

    setBusy(true);
    try {
      const ok = await onSave?.(config);
      if (ok === false) {
        return;
      }
      onMessage?.("Đã lưu Format & Venue Setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" fontWeight={700}>
            Format & Venue Setup
          </Typography>
          <Chip
            size="small"
            color={complete ? "success" : "default"}
            label={complete ? "Đã cấu hình" : "Chưa đủ"}
          />
          {!gateOn ? (
            <Chip size="small" color="warning" label="Cloud ghi tắt (V7 OFF)" />
          ) : null}
        </Stack>

        {!gateOn ? (
          <Alert severity="warning">
            Setup mutation v7 đang tắt. UI không hứa ghi cloud. Bật{" "}
            <strong>VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7</strong> (Owner GO) trước khi lưu
            Format & Venue / đội / bảng.
          </Alert>
        ) : null}

        <FormControl fullWidth size="small" disabled={!canManage}>
          <InputLabel>Format</InputLabel>
          <Select
            label="Format"
            value={formatPreset}
            onChange={(event) => handleFormatChange(event.target.value)}
          >
            <MenuItem value={FORMAT_PRESET.MLP_4}>MLP 4 người</MenuItem>
            <MenuItem value={FORMAT_PRESET.CUSTOM}>Tùy chỉnh</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="subtitle2" fontWeight={700}>
          Quy tắc đội hình
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {[
            ["teamSize", "Sĩ số đội"],
            ["minPlayers", "Min VĐV"],
            ["maxPlayers", "Max VĐV"],
            ["requiredMales", "Nam bắt buộc"],
            ["requiredFemales", "Nữ bắt buộc"],
          ].map(([key, label]) => (
            <TextField
              key={key}
              size="small"
              type="number"
              label={label}
              value={rosterRules?.[key] ?? ""}
              disabled={!canManage || formatPreset === FORMAT_PRESET.MLP_4}
              onChange={(event) =>
                setRosterRules((prev) => ({
                  ...prev,
                  [key]: Number(event.target.value),
                }))
              }
              inputProps={{ min: 0 }}
              fullWidth
            />
          ))}
        </Stack>

        <FormControlLabel
          control={
            <Switch
              checked={Boolean(dreambreakerEnabled)}
              disabled={!canManage || formatPreset === FORMAT_PRESET.MLP_4}
              onChange={(event) => setDreambreakerEnabled(event.target.checked)}
            />
          }
          label="Dreambreaker"
        />

        <FormControl fullWidth size="small" disabled={!canManage}>
          <InputLabel>Group setup</InputLabel>
          <Select
            label="Group setup"
            value={groupSetup}
            onChange={(event) => handleGroupSetupChange(event.target.value)}
          >
            {GROUP_SETUP_CHOICES.map((choice) => (
              <MenuItem key={choice.value} value={choice.value}>
                {choice.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {(groupSetup === "custom" || groupSetup === "auto") && (
          <TextField
            size="small"
            type="number"
            label="Số bảng (groupCount)"
            value={groupCount}
            disabled={!canManage || groupSetup === "auto"}
            onChange={(event) => setGroupCount(Math.max(1, Number(event.target.value) || 1))}
            inputProps={{ min: 1 }}
            helperText={
              groupSetup === "auto"
                ? `Gợi ý tự động: ${groupCount} bảng (organizer vẫn có thể đổi sang Tùy chỉnh).`
                : "Tối thiểu 1 bảng — không bắt buộc 2 bảng."
            }
          />
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            type="number"
            label="Số đội vượt bảng / pool (qualificationCount)"
            value={qualificationCount}
            disabled={!canManage}
            onChange={(event) =>
              setQualificationCount(Math.max(1, Number(event.target.value) || 1))
            }
            inputProps={{ min: 1 }}
            fullWidth
          />
          <FormControl fullWidth size="small" disabled={!canManage}>
            <InputLabel>Knockout</InputLabel>
            <Select
              label="Knockout"
              value={knockoutFormat}
              onChange={(event) => setKnockoutFormat(event.target.value)}
            >
              <MenuItem value={KNOCKOUT_FORMAT.TOP_N}>Top N (seed)</MenuItem>
              <MenuItem value={KNOCKOUT_FORMAT.FINAL_ONLY}>Chung kết (top 2)</MenuItem>
              <MenuItem value={KNOCKOUT_FORMAT.SEMIFINALS}>Bán kết (top 4 → 1v4, 2v3)</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2" fontWeight={700}>
              Chọn sân (selectedCourtIds)
            </Typography>
            <Button size="small" disabled={!canManage || venueCourts.length === 0} onClick={selectAllCourts}>
              Chọn tất cả
            </Button>
            <Button size="small" disabled={!canManage} onClick={clearCourts}>
              Bỏ chọn
            </Button>
          </Stack>
          {venueCourts.length === 0 ? (
            <Alert severity="info">
              CLB chưa có sân trong inventory. Có thể tiếp tục thiết lập; công bố lịch sẽ bị chặn
              đến khi chọn sân.
            </Alert>
          ) : (
            <FormGroup>
              {venueCourts.map((court) => (
                <FormControlLabel
                  key={court.id}
                  control={
                    <Checkbox
                      checked={selectedCourtIds.includes(String(court.id))}
                      disabled={!canManage}
                      onChange={() => toggleCourt(court.id)}
                    />
                  }
                  label={getCourtDisplayName(court)}
                />
              ))}
            </FormGroup>
          )}
          {!courtPublishGate.ok ? (
            <Alert severity="warning">{courtPublishGate.error}</Alert>
          ) : (
            <Alert severity="success">
              Đã chọn {selectedCourtIds.length} sân — lịch sẽ dùng các ID này (không dùng Sân N giả).
            </Alert>
          )}
        </Stack>

        {canManage ? (
          <Button variant="contained" disabled={busy} onClick={handleSave}>
            Lưu Format & Venue
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
