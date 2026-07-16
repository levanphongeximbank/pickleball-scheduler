import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { resolveCanonicalAthleteRating } from "../../pairing-candidates/canonicalAthleteRating.js";
import { getPlayerGenderKey } from "../../../models/player.js";
import { listGroupDivisionOptions } from "../engines/teamGroupDivisionPolicy.js";
import {
  SHOWCASE_CLUB_SCOPE,
  buildShowcaseActionGates,
  buildShowcaseAthleteCounters,
  buildShowcaseTeamConfiguration,
  clearShowcaseAthleteSelection,
  filterShowcaseAthletesForDisplay,
  mergeShowcaseAthletePool,
  resolveShowcaseClubScopeConfig,
  selectAllEligibleShowcaseAthletes,
  selectShowcaseAthletesByClub,
  selectShowcaseAthletesByGender,
  toggleShowcaseAthleteSelection,
} from "./showcaseSetupModel.js";
import ShowcaseMatchupSection from "./ShowcaseMatchupSection.jsx";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY, SHOWCASE_DEFAULT_TEAM_COUNT } from "./showcaseConstants.js";

function DisabledButton({ disabled, reason, children, ...props }) {
  const button = (
    <Button disabled={disabled} {...props}>
      {children}
    </Button>
  );
  if (!disabled || !reason) return button;
  return (
    <Tooltip title={reason}>
      <span>{button}</span>
    </Tooltip>
  );
}

/**
 * Unified Owner control center before/during ceremony setup.
 */
export default function ShowcaseSetup({
  tournament = null,
  clubs = [],
  user = null,
  canSelectTenantScope = false,
  canManageClub,
  clubAthletes = [],
  tenantAthletes = [],
  poolLoading = false,
  poolError = null,
  hostClubId = "",
  setupConfig = {},
  preflight,
  teamPreviewDiagnostics = null,
  hasTeamPreview = false,
  hasGroupPreview = false,
  matchupPreview = null,
  mode = "live",
  saving = false,
  onChange,
  onGenerateTeams,
  onRegenerateTeams,
  onPreviewTeams,
  onStartTeamReveal,
  onGenerateGroups,
  onRegenerateGroups,
  onPreviewGroups,
  onStartGroupReveal,
  onGenerateMatchups,
  onConfirmMatchups,
  onConfirmSave,
  onSaveDraftContinue,
  onCancelPreview,
  onBack,
  onContinueSchedule,
}) {
  const scopeConfig = useMemo(
    () =>
      resolveShowcaseClubScopeConfig({
        tournament,
        clubs,
        user,
        canSelectTenantScope,
        canManageClub,
        scopeMode: setupConfig.scopeMode,
        selectedClubId: setupConfig.selectedClubId || hostClubId,
        hostClubId,
      }),
    [
      tournament,
      clubs,
      user,
      canSelectTenantScope,
      canManageClub,
      setupConfig.scopeMode,
      setupConfig.selectedClubId,
      hostClubId,
    ]
  );

  const athletes = useMemo(
    () =>
      mergeShowcaseAthletePool({
        scopeMode: scopeConfig.scopeMode,
        clubAthletes,
        tenantAthletes,
        clubs,
        selectedClubId: scopeConfig.selectedClubId,
        hostClubId: scopeConfig.hostClubId,
      }),
    [
      clubAthletes,
      tenantAthletes,
      clubs,
      scopeConfig.scopeMode,
      scopeConfig.hostClubId,
      scopeConfig.selectedClubId,
    ]
  );

  const selectedAthleteIds = useMemo(
    () => setupConfig.selectedAthleteIds || [],
    [setupConfig.selectedAthleteIds]
  );
  const teamCount = Number(setupConfig.teamCount) || SHOWCASE_DEFAULT_TEAM_COUNT;
  const groupCount = Number(setupConfig.groupCount) || 2;

  const counters = useMemo(
    () => buildShowcaseAthleteCounters(athletes, selectedAthleteIds),
    [athletes, selectedAthleteIds]
  );

  const teamConfig = useMemo(
    () =>
      buildShowcaseTeamConfiguration({
        athletes,
        selectedAthleteIds,
        requestedTeamCount: teamCount,
        athletesPerTeam: setupConfig.athletesPerTeam || 4,
        formatPreset: setupConfig.formatPreset,
      }),
    [athletes, selectedAthleteIds, teamCount, setupConfig.athletesPerTeam, setupConfig.formatPreset]
  );

  const displayAthletes = useMemo(
    () =>
      filterShowcaseAthletesForDisplay(athletes, {
        search: setupConfig.search,
        genderFilter: setupConfig.genderFilter,
        clubFilter: setupConfig.clubFilter,
        showSelectedOnly: setupConfig.showSelectedOnly,
        selectedAthleteIds,
      }),
    [athletes, setupConfig, selectedAthleteIds]
  );

  const groupOptions = useMemo(
    () => listGroupDivisionOptions(teamConfig.expectedTeamCount || teamCount),
    [teamConfig.expectedTeamCount, teamCount]
  );

  const clubOptionsForFilter = useMemo(() => {
    const seen = new Map();
    for (const athlete of athletes) {
      const clubId = String(athlete.clubId || athlete.membershipClubId || "").trim();
      const clubName = athlete.clubName || clubId;
      if (clubId) seen.set(clubId, clubName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [athletes]);

  const gates = buildShowcaseActionGates({
    counters,
    teamConfig,
    preflight,
    hasTeamPreview,
    hasGroupPreview,
    matchupPreview,
    mode,
    saving,
  });

  function emit(patch) {
    onChange?.({
      ...setupConfig,
      teamCount,
      groupCount,
      selectedAthleteIds,
      ...patch,
    });
  }

  const selectedSet = new Set(selectedAthleteIds.map(String));

  return (
    <Stack spacing={3} maxWidth={960} mx="auto" width="100%">
      <Typography component="h1" sx={showcaseTitleSx}>
        Thiết lập lễ bốc thăm
      </Typography>

      {poolLoading ? <Alert severity="info">Đang tải pool VĐV canonical…</Alert> : null}
      {poolError ? <Alert severity="error">{poolError}</Alert> : null}
      {scopeConfig.locked && scopeConfig.lockReason ? (
        <Alert severity="info">{scopeConfig.lockReason}</Alert>
      ) : null}

      <Box sx={showcaseCardSx}>
        <Stack spacing={2}>
          <Typography fontWeight={700}>Phạm vi câu lạc bộ</Typography>
          <FormControl fullWidth>
            <Select
              value={
                scopeConfig.scopeMode === SHOWCASE_CLUB_SCOPE.TENANT
                  ? SHOWCASE_CLUB_SCOPE.TENANT
                  : scopeConfig.selectedClubId || scopeConfig.hostClubId || ""
              }
              disabled={scopeConfig.locked || poolLoading}
              onChange={(event) => {
                const value = event.target.value;
                if (value === SHOWCASE_CLUB_SCOPE.TENANT) {
                  emit({ scopeMode: SHOWCASE_CLUB_SCOPE.TENANT, selectedClubId: "" });
                  return;
                }
                emit({
                  scopeMode: SHOWCASE_CLUB_SCOPE.CLUB,
                  selectedClubId: value,
                });
              }}
              sx={{
                color: "#f4f7fb",
                ".MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(124,255,178,0.35)",
                },
              }}
            >
              {scopeConfig.canSelectTenantScope ? (
                <MenuItem value={SHOWCASE_CLUB_SCOPE.TENANT}>
                  Tất cả CLB được phép quản lý
                </MenuItem>
              ) : null}
              {scopeConfig.permittedClubs.map((club) => (
                <MenuItem key={club.id} value={club.id}>
                  {club.name || club.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      <Box sx={showcaseCardSx}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <DisabledButton
              size="small"
              variant="outlined"
              color="inherit"
              disabled={gates.selectAll.disabled}
              reason={gates.selectAll.reason}
              onClick={() =>
                emit({
                  selectedAthleteIds: selectAllEligibleShowcaseAthletes(athletes),
                })
              }
            >
              Chọn tất cả
            </DisabledButton>
            <DisabledButton
              size="small"
              variant="outlined"
              color="inherit"
              disabled={gates.clearAll.disabled}
              reason={gates.clearAll.reason}
              onClick={() => emit({ selectedAthleteIds: clearShowcaseAthleteSelection() })}
            >
              Bỏ chọn tất cả
            </DisabledButton>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() =>
                emit({
                  selectedAthleteIds: selectShowcaseAthletesByGender(
                    athletes,
                    selectedAthleteIds,
                    "male"
                  ),
                })
              }
            >
              Chọn nam
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() =>
                emit({
                  selectedAthleteIds: selectShowcaseAthletesByGender(
                    athletes,
                    selectedAthleteIds,
                    "female"
                  ),
                })
              }
            >
              Chọn nữ
            </Button>
            {clubOptionsForFilter.map((club) => (
              <Button
                key={club.id}
                size="small"
                variant="text"
                color="inherit"
                onClick={() =>
                  emit({
                    selectedAthleteIds: selectShowcaseAthletesByClub(
                      athletes,
                      selectedAthleteIds,
                      club.id
                    ),
                  })
                }
              >
                Chọn theo {club.name}
              </Button>
            ))}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Tìm kiếm VĐV"
              value={setupConfig.search || ""}
              onChange={(event) => emit({ search: event.target.value })}
              fullWidth
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={setupConfig.genderFilter || "all"}
                onChange={(event) => emit({ genderFilter: event.target.value })}
              >
                <MenuItem value="all">Tất cả giới tính</MenuItem>
                <MenuItem value="male">Nam</MenuItem>
                <MenuItem value="female">Nữ</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(setupConfig.showSelectedOnly)}
                  onChange={(event) => emit({ showSelectedOnly: event.target.checked })}
                />
              }
              label="Chỉ hiển thị VĐV đã chọn"
            />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`Tổng: ${counters.totalAvailable}`} size="small" />
            <Chip label={`Đã chọn: ${counters.selectedCount}`} size="small" color="success" />
            <Chip label={`Nam: ${counters.selectedMale}`} size="small" />
            <Chip label={`Nữ: ${counters.selectedFemale}`} size="small" />
            <Chip label={`Chưa XĐ giới tính: ${counters.selectedUnknown}`} size="small" />
            <Chip label={`Có rating: ${counters.selectedWithRating}`} size="small" />
            <Chip label={`Chưa rating: ${counters.selectedWithoutRating}`} size="small" />
            <Chip label={`Thiếu identity: ${counters.selectedMissingIdentity}`} size="small" />
            <Chip label={`Không đủ ĐK: ${counters.selectedIneligible}`} size="small" />
          </Stack>

          <Box
            sx={{
              maxHeight: 260,
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 0.5,
              p: 1,
              borderRadius: 1,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {displayAthletes.map((athlete, index) => {
              const athleteId = String(athlete?.id || "");
              const rating = resolveCanonicalAthleteRating(athlete);
              const gender = getPlayerGenderKey(athlete.gender);
              const genderLabel =
                gender === "male" ? "Nam" : gender === "female" ? "Nữ" : "—";
              return (
                <FormControlLabel
                  key={athleteId || `row-${index}`}
                  control={
                    <Checkbox
                      size="small"
                      checked={athleteId ? selectedSet.has(athleteId) : false}
                      disabled={!athleteId}
                      onChange={(event) =>
                        emit({
                          selectedAthleteIds: toggleShowcaseAthleteSelection(
                            selectedAthleteIds,
                            athleteId,
                            event.target.checked
                          ),
                        })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Box>{athlete.name || athlete.displayName || athleteId}</Box>
                      <Box sx={showcaseMutedSx}>
                        {genderLabel} · {Number(rating?.ratingValue || 0).toFixed(1)} ·{" "}
                        {athlete.clubName || "—"}
                      </Box>
                    </Box>
                  }
                />
              );
            })}
          </Box>
        </Stack>
      </Box>

      <Box sx={showcaseCardSx}>
        <Stack spacing={2}>
          <Typography fontWeight={700}>Cấu hình đội</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Số đội yêu cầu"
              type="number"
              value={teamCount}
              inputProps={{ min: 2, max: 16 }}
              onChange={(event) => {
                const next = Number(event.target.value);
                const options = listGroupDivisionOptions(next);
                emit({
                  teamCount: next,
                  groupCount:
                    options.find((option) => option.groupCount === groupCount)?.groupCount ||
                    options[0]?.groupCount ||
                    groupCount,
                });
              }}
            />
            <TextField
              label="Số VĐV mỗi đội"
              type="number"
              value={setupConfig.athletesPerTeam || 4}
              disabled
              InputProps={{ readOnly: true }}
            />
            <TextField label="Preset giải" value="MLP 4 người" disabled />
          </Stack>
          <Stack spacing={0.5} sx={showcaseMutedSx}>
            <Box>
              Đội dự kiến: {teamConfig.expectedTeamCount}/{teamConfig.requestedTeamCount}
            </Box>
            <Box>Danh sách chờ dự kiến: {teamConfig.expectedWaitingListCount}</Box>
            <Box>Nam còn thừa: {teamConfig.surplusMale}</Box>
            <Box>Nữ còn thừa: {teamConfig.surplusFemale}</Box>
          </Stack>
          {teamConfig.guidance.map((message) => (
            <Alert key={message} severity="warning">
              {message}
            </Alert>
          ))}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <DisabledButton
              variant="contained"
              color="success"
              disabled={gates.generateTeams.disabled}
              reason={gates.generateTeams.reason}
              onClick={onGenerateTeams}
            >
              {SHOWCASE_COPY.generateTeams}
            </DisabledButton>
            <DisabledButton
              variant="outlined"
              color="warning"
              disabled={gates.regenerateTeams.disabled}
              reason={gates.regenerateTeams.reason}
              onClick={onRegenerateTeams}
            >
              {SHOWCASE_COPY.regenerateTeams}
            </DisabledButton>
            <Button variant="outlined" color="inherit" onClick={onPreviewTeams} disabled={!hasTeamPreview}>
              {SHOWCASE_COPY.previewTeams}
            </Button>
            <DisabledButton
              variant="contained"
              color="primary"
              disabled={gates.startTeamReveal.disabled}
              reason={gates.startTeamReveal.reason}
              onClick={onStartTeamReveal}
            >
              {SHOWCASE_COPY.startTeamReveal}
            </DisabledButton>
          </Stack>
          {teamPreviewDiagnostics ? (
            <Box sx={showcaseMutedSx}>
              Preview: {teamPreviewDiagnostics.teamCount} đội · chờ{" "}
              {teamPreviewDiagnostics.waitingListCount} · spread{" "}
              {teamPreviewDiagnostics.balanceSpread}
            </Box>
          ) : null}
        </Stack>
      </Box>

      <Box sx={showcaseCardSx}>
        <Stack spacing={2}>
          <Typography fontWeight={700}>Kiểu chia bảng</Typography>
          <FormControl>
            <RadioGroup
              value={String(groupCount)}
              onChange={(event) => emit({ groupCount: Number(event.target.value) })}
            >
              {groupOptions.map((option) => (
                <FormControlLabel
                  key={option.groupCount}
                  value={String(option.groupCount)}
                  control={<Radio />}
                  label={option.label}
                  disabled={!hasTeamPreview}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <DisabledButton
              variant="outlined"
              color="inherit"
              disabled={gates.generateGroups.disabled}
              reason={gates.generateGroups.reason}
              onClick={() => onGenerateGroups?.({ groupCount, auto: true })}
            >
              Chia bảng tự động
            </DisabledButton>
            <Tooltip title="Tính năng chia bảng thủ công đang hoàn thiện.">
              <span>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled
                  aria-disabled="true"
                >
                  Chia bảng thủ công
                </Button>
              </span>
            </Tooltip>
            <Box sx={showcaseMutedSx}>
              Tính năng chia bảng thủ công đang hoàn thiện.
            </Box>
            <Button variant="outlined" color="warning" disabled={!hasGroupPreview} onClick={onRegenerateGroups}>
              Chia lại bảng
            </Button>
            <Button variant="outlined" color="inherit" disabled={!hasGroupPreview} onClick={onPreviewGroups}>
              {SHOWCASE_COPY.previewGroups}
            </Button>
            <DisabledButton
              variant="contained"
              color="primary"
              disabled={gates.startGroupReveal.disabled}
              reason={gates.startGroupReveal.reason}
              onClick={onStartGroupReveal}
            >
              {SHOWCASE_COPY.startGroupReveal}
            </DisabledButton>
          </Stack>
        </Stack>
      </Box>

      <Box sx={showcaseCardSx}>
        <ShowcaseMatchupSection
          matchupPreview={matchupPreview}
          onGenerate={onGenerateMatchups}
          onConfirm={onConfirmMatchups}
          onContinueSchedule={onContinueSchedule}
          generateDisabled={gates.generateMatchups.disabled}
          generateReason={gates.generateMatchups.reason}
          confirmDisabled={gates.confirmMatchups.disabled}
          confirmReason={gates.confirmMatchups.reason}
          saving={saving}
        />
      </Box>

      {(preflight?.blockers || []).map((blocker) => (
        <Alert key={blocker} severity="error">
          {blocker}
        </Alert>
      ))}
      {(teamConfig.blockers || []).map((blocker) => (
        <Alert key={`tc-${blocker}`} severity="error">
          {blocker}
        </Alert>
      ))}

      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Quay lại
        </Button>
        <Button variant="outlined" color="warning" onClick={onCancelPreview}>
          {SHOWCASE_COPY.cancelUnsaved}
        </Button>
        <Button variant="outlined" color="inherit" onClick={onSaveDraftContinue}>
          {SHOWCASE_COPY.saveDraftContinue}
        </Button>
        <DisabledButton
          variant="contained"
          color="success"
          disabled={gates.confirmSave.disabled}
          reason={gates.confirmSave.reason}
          onClick={onConfirmSave}
        >
          {SHOWCASE_COPY.confirmSave}
        </DisabledButton>
      </Box>
    </Stack>
  );
}
