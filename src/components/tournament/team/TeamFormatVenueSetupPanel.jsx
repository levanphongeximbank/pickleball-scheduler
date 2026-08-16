import { useEffect, useMemo, useRef, useState } from "react";
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
  COMPETITION_STAGE,
  FORMAT_PRESET,
  GROUP_MODE,
  KNOCKOUT_FORMAT,
  STAGE_TIE_BREAK_POLICY,
  STAGE_TIE_BREAK_POLICY_KEYS,
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
import { listLockedCompetitionStages } from "../../../features/team-tournament/engines/teamStageTieBreakPolicy.js";
import {
  TEAM_COURT_DISCOVERY_OUTCOME,
  createTeamTournamentCourtAdapter,
  classifyTeamCourtDiscovery,
} from "../../../features/team-tournament/adapters/canonical/TeamTournamentCourtAdapter.js";
import {
  DEFAULT_STAGE_SCORING_ENTRY,
  DEFAULT_STAGE_SCORING_POLICY,
  normalizeStageScoringMode,
  normalizeStageScoringPolicy,
  STAGE_SCORING_MODE,
  STAGE_SCORING_MODE_LABELS,
} from "../../../features/team-tournament/engines/teamStageScoringPolicy.js";
import { isSetupMutationFoundationEnabled } from "../../../features/team-tournament/setup/setupMutationFeatureGate.js";
import {
  buildFormatVenueFingerprint,
  decideSetupFormRehydration,
} from "../../../features/team-tournament/setup/setupFormRehydration.js";
import {
  hydrateTeamTournamentNameDraft,
  renameTeamTournamentDisplayName,
} from "../../../features/team-tournament/services/teamTournamentRenameService.js";
import { getCourtDisplayName } from "../../../pages/courts.logic.js";

async function listEligibleCourtsForFormatVenue(params = {}) {
  const adapter = params.courtAdapter || createTeamTournamentCourtAdapter();
  const request = {
    clubId: params.clubId,
    tenantId: params.tenantId,
    venueId: params.venueId,
    competitionId: params.competitionId || params.tournamentId,
    competitionType: "team",
    clusterId: params.clusterId,
  };
  const missing = classifyTeamCourtDiscovery(request, null);
  if (missing.outcome === TEAM_COURT_DISCOVERY_OUTCOME.MISSING_TEAM_CONTEXT) {
    return {
      ...missing,
      clusters: [],
      courts: [],
    };
  }
  const listed = await adapter.listEligibleCourts(request);
  const classified = classifyTeamCourtDiscovery(request, listed);
  return {
    ...classified,
    // Keep legacy fields for existing callers.
    ok: classified.ok,
    error: classified.error,
    code: classified.code,
    courts:
      params.clusterId && classified.ok
        ? classified.courts.filter(
            (court) => String(court.clusterId || "") === String(params.clusterId)
          )
        : classified.courts,
    clusters: classified.clusters,
  };
}

const STAGE_POLICY_LABELS = {
  [COMPETITION_STAGE.GROUP]: "Vòng bảng",
  [COMPETITION_STAGE.ROUND_OF_16]: "Vòng 16",
  [COMPETITION_STAGE.QUARTERFINAL]: "Tứ kết",
  [COMPETITION_STAGE.SEMIFINAL]: "Bán kết",
  [COMPETITION_STAGE.FINAL]: "Chung kết",
};

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
  tenantId = null,
  registeredClusterId = "",
  canManage = false,
  teamCountHint = 0,
  onSave,
  onError,
  onMessage,
  /** Preview-only diagnostic: reports local Format dirty vs last loaded defaults. */
  onFormatDirtyDiagnostic = null,
  /** @internal test override */
  listCourtsFn = listEligibleCourtsForFormatVenue,
  /** @internal test override — omit to derive clusters from canonical eligible courts */
  listClustersFn = null,
  /** @internal test override — canonical rename only (not Format & Venue blob). */
  renameTournamentFn = renameTeamTournamentDisplayName,
}) {
  const gateOn = isSetupMutationFoundationEnabled();
  const defaults = useMemo(
    () => resolveFormatVenueDefaults(teamData, tournament),
    [teamData, tournament]
  );

  const resolvedClubId = clubId || tournament?.clubId || "";
  const resolvedTenantId = tenantId || tournament?.tenantId || null;
  const resolvedVenueId = tournament?.venueId || null;

  const [venueCourts, setVenueCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(Boolean(resolvedClubId));
  const [courtsError, setCourtsError] = useState(null);
  const [nameDraft, setNameDraft] = useState(() =>
    hydrateTeamTournamentNameDraft(tournament)
  );
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const nameDirtyRef = useRef(false);

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
  const [clusterId, setClusterId] = useState(defaults.clusterId || "");
  const [selectedCourtIds, setSelectedCourtIds] = useState(defaults.selectedCourtIds || []);
  const [courtCapacityWindow, setCourtCapacityWindow] = useState(
    defaults.courtCapacityWindow || { date: "", startTime: "", endTime: "" }
  );
  const [stageTieBreakPolicy, setStageTieBreakPolicy] = useState(
    defaults.stageTieBreakPolicy
  );
  const [stageScoringPolicy, setStageScoringPolicy] = useState(
    normalizeStageScoringPolicy(defaults.stageScoringPolicy || DEFAULT_STAGE_SCORING_POLICY)
  );
  const [busy, setBusy] = useState(false);
  const [serverBaselineFingerprint, setServerBaselineFingerprint] = useState(null);
  const [acceptServerBaseline, setAcceptServerBaseline] = useState(false);
  const lockedStages = useMemo(
    () => listLockedCompetitionStages(teamData),
    [teamData]
  );
  const [canonicalClusters, setCanonicalClusters] = useState([]);
  const [clusterDiscovery, setClusterDiscovery] = useState({
    outcome: null,
    code: null,
    error: null,
  });
  const clusterOptions = useMemo(() => {
    if (typeof listClustersFn === "function") {
      return resolvedTenantId ? listClustersFn(resolvedTenantId) : [];
    }
    return canonicalClusters;
  }, [canonicalClusters, listClustersFn, resolvedTenantId]);
  const selectedCourtIdsOutsideCluster = useMemo(() => {
    if (courtsLoading || !clusterId) return [];
    const scopedIds = new Set(venueCourts.map((court) => String(court.id)));
    return selectedCourtIds.filter((courtId) => !scopedIds.has(String(courtId)));
  }, [clusterId, courtsLoading, selectedCourtIds, venueCourts]);
  const serverFingerprint = useMemo(
    () => buildFormatVenueFingerprint(defaults),
    [defaults]
  );

  const formatDirty = useMemo(() => {
    const choice = GROUP_SETUP_CHOICES.find((item) => item.value === groupSetup);
    const resolvedGroupMode =
      choice?.groupMode ||
      (Number(groupCount) === 1 ? GROUP_MODE.SINGLE_POOL : GROUP_MODE.MANUAL);
    const courtsEqual =
      JSON.stringify([...(selectedCourtIds || [])].map(String).sort()) ===
      JSON.stringify(
        [...(defaults.selectedCourtIds || [])].map(String).sort()
      );
    return (
      formatPreset !== defaults.formatPreset ||
      Boolean(dreambreakerEnabled) !== Boolean(defaults.dreambreakerEnabled) ||
      Number(groupCount) !== Number(defaults.groupCount || 1) ||
      Number(qualificationCount) !== Number(defaults.qualificationCount || 2) ||
      knockoutFormat !== defaults.knockoutFormat ||
      clusterId !== (defaults.clusterId || "") ||
      JSON.stringify(courtCapacityWindow) !==
        JSON.stringify(
          defaults.courtCapacityWindow || { date: "", startTime: "", endTime: "" }
        ) ||
      resolvedGroupMode !== defaults.groupMode ||
      JSON.stringify(rosterRules || {}) !== JSON.stringify(defaults.rosterRules || {}) ||
      JSON.stringify(stageTieBreakPolicy || {}) !==
        JSON.stringify(defaults.stageTieBreakPolicy || {}) ||
      JSON.stringify(stageScoringPolicy || {}) !==
        JSON.stringify(
          normalizeStageScoringPolicy(
            defaults.stageScoringPolicy || DEFAULT_STAGE_SCORING_POLICY
          )
        ) ||
      !courtsEqual
    );
  }, [
    defaults,
    dreambreakerEnabled,
    clusterId,
    courtCapacityWindow,
    formatPreset,
    groupCount,
    groupSetup,
    knockoutFormat,
    qualificationCount,
    rosterRules,
    selectedCourtIds,
    stageScoringPolicy,
    stageTieBreakPolicy,
  ]);

  useEffect(() => {
    const decision = decideSetupFormRehydration({
      dirty: formatDirty,
      prevFingerprint: serverBaselineFingerprint,
      nextFingerprint: serverFingerprint,
      afterSuccessfulMutation: acceptServerBaseline,
    });
    if (!decision.rehydrate) {
      return;
    }
    setFormatPreset(defaults.formatPreset);
    setRosterRules(defaults.rosterRules);
    setDreambreakerEnabled(defaults.dreambreakerEnabled);
    setGroupSetup(resolveGroupSetupValue(defaults));
    setGroupCount(defaults.groupCount || 1);
    setQualificationCount(defaults.qualificationCount || 2);
    setKnockoutFormat(defaults.knockoutFormat);
    setClusterId(defaults.clusterId || "");
    setSelectedCourtIds(defaults.selectedCourtIds || []);
    setCourtCapacityWindow(
      defaults.courtCapacityWindow || { date: "", startTime: "", endTime: "" }
    );
    setStageTieBreakPolicy(defaults.stageTieBreakPolicy);
    setStageScoringPolicy(
      normalizeStageScoringPolicy(defaults.stageScoringPolicy || DEFAULT_STAGE_SCORING_POLICY)
    );
    setServerBaselineFingerprint(serverFingerprint);
    if (acceptServerBaseline) {
      setAcceptServerBaseline(false);
    }
  }, [
    acceptServerBaseline,
    defaults,
    formatDirty,
    serverBaselineFingerprint,
    serverFingerprint,
  ]);

  useEffect(() => {
    if (typeof listClustersFn === "function") return undefined;
    let cancelled = false;
    if (!resolvedClubId || !resolvedTenantId) {
      setCanonicalClusters([]);
      setClusterDiscovery({
        outcome: TEAM_COURT_DISCOVERY_OUTCOME.MISSING_TEAM_CONTEXT,
        code: "MISSING_TEAM_CONTEXT",
        error: !resolvedClubId
          ? "Thiếu clubId — không gọi Competition Court Adapter."
          : "Thiếu tenantId — không gọi Competition Court Adapter.",
      });
      return undefined;
    }
    void listEligibleCourtsForFormatVenue({
      clubId: resolvedClubId,
      tenantId: resolvedTenantId,
      venueId: resolvedVenueId,
      competitionId: tournament?.id,
    }).then((result) => {
      if (cancelled) return;
      setCanonicalClusters(result?.clusters || []);
      setClusterDiscovery({
        outcome: result?.outcome || null,
        code: result?.code || null,
        error: result?.error || null,
      });
    }).catch((error) => {
      if (cancelled) return;
      setCanonicalClusters([]);
      setClusterDiscovery({
        outcome: TEAM_COURT_DISCOVERY_OUTCOME.END_A_ERROR,
        code: "DATA_UNAVAILABLE",
        error: error?.message || "Competition Court Adapter V1 thất bại.",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [listClustersFn, resolvedClubId, resolvedTenantId, resolvedVenueId, tournament?.id]);

  useEffect(() => {
    if (clusterId || defaults.clusterId || !registeredClusterId) return;
    const registered = clusterOptions.filter(
      (cluster) => String(cluster.id) === String(registeredClusterId)
    );
    if (clusterOptions.length === 1 && registered.length === 1) {
      setClusterId(String(registered[0].id));
    }
  }, [
    clusterId,
    clusterOptions,
    defaults.clusterId,
    registeredClusterId,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedClubId || !clusterId) {
      setVenueCourts([]);
      setCourtsLoading(false);
      setCourtsError(
        !resolvedClubId
          ? "Thiếu clubId — không tải inventory sân."
          : "Chọn cụm sân trước khi tải sân vật lý."
      );
      return undefined;
    }

    setCourtsLoading(true);
    setCourtsError(null);

    void listCourtsFn({
      clubId: resolvedClubId,
      tenantId: resolvedTenantId,
      venueId: resolvedVenueId,
      competitionId: tournament?.id,
      clusterId,
    }).then((result) => {
      if (cancelled) return;
      setCourtsLoading(false);
      if (!result?.ok) {
        setVenueCourts([]);
        setCourtsError(result?.error || "Không tải được sân trong cụm từ cloud.");
        return;
      }
      setVenueCourts(Array.isArray(result.courts) ? result.courts : []);
      setCourtsError(null);
    }).catch((error) => {
      if (cancelled) return;
      setCourtsLoading(false);
      setVenueCourts([]);
      setCourtsError(error?.message || "Không tải được sân từ cloud.");
    });

    return () => {
      cancelled = true;
    };
  }, [clusterId, resolvedClubId, resolvedTenantId, resolvedVenueId, listCourtsFn, tournament?.id]);

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
        clusterId,
        selectedCourtIds,
        courtCapacityWindow,
        stageTieBreakPolicy,
      }),
    },
    tournament
  );

  useEffect(() => {
    onFormatDirtyDiagnostic?.(formatDirty === true);
  }, [formatDirty, onFormatDirtyDiagnostic]);

  useEffect(() => {
    if (nameDirtyRef.current) return;
    setNameDraft(hydrateTeamTournamentNameDraft(tournament));
  }, [tournament]);

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

  function handleClusterChange(nextClusterId) {
    setClusterId(String(nextClusterId || ""));
    setSelectedCourtIds([]);
    setVenueCourts([]);
  }

  async function handleSaveName() {
    if (!canManage) return;

    const nextName = String(nameDraft || "").trim();
    if (!nextName) {
      const error = "Tên giải không được để trống.";
      setNameError(error);
      onError?.(error);
      return;
    }

    setNameBusy(true);
    setNameError("");
    try {
      const result = await renameTournamentFn({
        canManage: true,
        clubId: resolvedClubId,
        tenantId: resolvedTenantId,
        tournamentId: tournament?.id,
        name: nextName,
      });
      if (!result?.ok) {
        const error = result?.error || "Không thể lưu tên giải. Vui lòng thử lại.";
        setNameError(error);
        onError?.(error);
        return;
      }
      const savedName = String(result.tournament?.name || nextName).trim();
      nameDirtyRef.current = false;
      setNameDraft(savedName);
      onMessage?.("Đã lưu tên giải.");
    } finally {
      setNameBusy(false);
    }
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
      qualifiersPerGroup: Math.max(1, Number(qualificationCount) || 1),
      knockoutFormat,
      clusterId,
      stageTieBreakPolicy,
      stageScoringPolicy: normalizeStageScoringPolicy(stageScoringPolicy),
      selectedCourtIds,
      courtCapacityWindow,
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
      setAcceptServerBaseline(true);
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
            Setup mutation v7 đang tắt bởi kill-switch{" "}
            <strong>VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7=false</strong>. Không ghi Format
            & Venue / đội / bảng.
          </Alert>
        ) : null}

        <Stack spacing={1}>
          <TextField
            size="small"
            fullWidth
            label="Tên giải"
            value={nameDraft}
            disabled={!canManage || nameBusy}
            onChange={(event) => {
              nameDirtyRef.current = true;
              setNameDraft(event.target.value);
            }}
            inputProps={{ "data-testid": "team-tournament-name-input" }}
          />
          {nameError ? <Alert severity="error">{nameError}</Alert> : null}
          {canManage ? (
            <Button
              variant="outlined"
              disabled={
                nameBusy ||
                !String(nameDraft || "").trim() ||
                String(nameDraft || "").trim() ===
                  String(tournament?.name || "").trim()
              }
              onClick={handleSaveName}
              data-testid="team-tournament-name-save"
            >
              {nameBusy ? "Đang lưu…" : "Lưu tên giải"}
            </Button>
          ) : null}
        </Stack>

        <FormControl fullWidth size="small" disabled={!canManage}>
          <InputLabel>Chọn cụm sân</InputLabel>
          <Select
            label="Chọn cụm sân"
            value={clusterId}
            onChange={(event) => handleClusterChange(event.target.value)}
            inputProps={{ "data-testid": "team-tournament-cluster-select" }}
          >
            <MenuItem value="">
              <em>Chưa chọn</em>
            </MenuItem>
            {clusterOptions.map((cluster) => (
              <MenuItem key={cluster.id} value={String(cluster.id)}>
                {cluster.name || cluster.label || cluster.id}
                {cluster.status ? ` — ${cluster.status}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {clusterDiscovery.outcome === TEAM_COURT_DISCOVERY_OUTCOME.MISSING_TEAM_CONTEXT ? (
          <Alert severity="error" data-testid="team-court-discovery-missing-context">
            {clusterDiscovery.error || "Thiếu clubId/tenantId — fail-closed."}
            {clusterDiscovery.code ? ` [${clusterDiscovery.code}]` : ""}
          </Alert>
        ) : null}
        {clusterDiscovery.outcome === TEAM_COURT_DISCOVERY_OUTCOME.END_A_ERROR ? (
          <Alert severity="error" data-testid="team-court-discovery-end-a-error">
            Competition Court Adapter V1 lỗi
            {clusterDiscovery.code ? ` (${clusterDiscovery.code})` : ""}
            {": "}
            {clusterDiscovery.error || "không giả thành công rỗng."}
          </Alert>
        ) : null}
        {clusterDiscovery.outcome === TEAM_COURT_DISCOVERY_OUTCOME.SUCCESS_EMPTY ? (
          <Alert severity="warning" data-testid="team-court-discovery-empty">
            Competition Court Adapter V1 trả ok nhưng không có Physical Court eligible
            cho club/tenant hiện tại. Không dùng venueId làm clusterId và không fallback
            local cluster registry.
          </Alert>
        ) : null}
        {resolvedTenantId &&
        clusterOptions.length === 0 &&
        !clusterDiscovery.outcome ? (
          <Alert severity="warning">
            Cluster choices come from canonical eligible Physical Courts. venueId is not clusterId.
          </Alert>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            type="date"
            label="Capacity date"
            value={courtCapacityWindow.date}
            disabled={!canManage}
            onChange={(event) =>
              setCourtCapacityWindow((prev) => ({ ...prev, date: event.target.value }))
            }
            InputLabelProps={{ shrink: true }}
            inputProps={{ "data-testid": "team-tournament-capacity-date" }}
            fullWidth
          />
          <TextField
            size="small"
            type="time"
            label="Reservation start time"
            value={courtCapacityWindow.startTime}
            disabled={!canManage}
            onChange={(event) =>
              setCourtCapacityWindow((prev) => ({
                ...prev,
                startTime: event.target.value,
              }))
            }
            InputLabelProps={{ shrink: true }}
            inputProps={{ "data-testid": "team-tournament-capacity-start" }}
            fullWidth
          />
          <TextField
            size="small"
            type="time"
            label="Reservation end time"
            value={courtCapacityWindow.endTime}
            disabled={!canManage}
            onChange={(event) =>
              setCourtCapacityWindow((prev) => ({ ...prev, endTime: event.target.value }))
            }
            InputLabelProps={{ shrink: true }}
            inputProps={{ "data-testid": "team-tournament-capacity-end" }}
            fullWidth
          />
        </Stack>

        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2" fontWeight={700}>
              Chọn sân vật lý (selectedCourtIds)
            </Typography>
            <Button size="small" disabled={!canManage || venueCourts.length === 0} onClick={selectAllCourts}>
              Chọn tất cả
            </Button>
            <Button size="small" disabled={!canManage} onClick={clearCourts}>
              Bỏ chọn
            </Button>
          </Stack>
          {courtsLoading ? (
            <Alert severity="info">Đang tải sân vật lý trong cụm từ cloud…</Alert>
          ) : courtsError ? (
            <Alert severity="info">{courtsError}</Alert>
          ) : venueCourts.length === 0 ? (
            <Alert severity="warning">
              Không có sân vật lý đã gắn với cụm đã chọn. Sân thiếu clusterId bị từ chối.
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
          {selectedCourtIdsOutsideCluster.length > 0 ? (
            <Alert severity="error">
              Có sân đã chọn chưa được gắn vào cụm sân hiện tại:{" "}
              {selectedCourtIdsOutsideCluster.join(", ")}. Hãy bỏ chọn hoặc cấu hình
              clusterId canonical cho sân.
            </Alert>
          ) : null}
          {!courtPublishGate.ok ? (
            <Alert severity="warning">{courtPublishGate.error}</Alert>
          ) : (
            <Alert severity="success">
              Đã chọn {selectedCourtIds.length} sân vật lý — courtId là authority.
            </Alert>
          )}
        </Stack>

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

        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Luật hòa theo vòng (stage tie-break)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Khi tỉ số trận con hòa (ví dụ 2–2): Dreambreaker giữ lifecycle hiện tại;
            Tổng điểm cộng điểm các trận con thường (không gồm Dreambreaker).
            Nếu tổng điểm cũng hòa, quay lại Dreambreaker hiện tại.
          </Typography>
          {STAGE_TIE_BREAK_POLICY_KEYS.map((stageKey) => {
            const locked = lockedStages.has(stageKey);
            return (
              <FormControl
                key={stageKey}
                fullWidth
                size="small"
                disabled={!canManage || locked}
              >
                <InputLabel>{STAGE_POLICY_LABELS[stageKey]}</InputLabel>
                <Select
                  label={STAGE_POLICY_LABELS[stageKey]}
                  value={
                    stageTieBreakPolicy?.[stageKey] || STAGE_TIE_BREAK_POLICY.DREAMBREAKER
                  }
                  onChange={(event) =>
                    setStageTieBreakPolicy((prev) => ({
                      ...prev,
                      [stageKey]: event.target.value,
                    }))
                  }
                >
                  <MenuItem value={STAGE_TIE_BREAK_POLICY.DREAMBREAKER}>
                    Dreambreaker
                  </MenuItem>
                  <MenuItem value={STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS}>
                    Tổng điểm các trận con
                  </MenuItem>
                </Select>
                {locked ? (
                  <Typography variant="caption" color="warning.main">
                    Đã khóa — vòng này đã bắt đầu thi đấu.
                  </Typography>
                ) : null}
              </FormControl>
            );
          })}
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Điểm theo vòng (stage scoring)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Áp dụng theo vòng đã resolve (#416), không đổi matchup.stage thô (group|knockout).
            21 chỉ là mặc định khi chưa cấu hình.
          </Typography>
          {STAGE_TIE_BREAK_POLICY_KEYS.map((stageKey) => {
            const entry =
              stageScoringPolicy?.[stageKey] || DEFAULT_STAGE_SCORING_POLICY[stageKey];
            return (
              <Stack
                key={`scoring-${stageKey}`}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
              >
                <Typography
                  variant="body2"
                  sx={{ minWidth: 96, pt: 1 }}
                  fontWeight={600}
                >
                  {STAGE_POLICY_LABELS[stageKey]}
                </Typography>
                <FormControl fullWidth size="small" disabled={!canManage}>
                  <InputLabel>Chế độ tính điểm</InputLabel>
                  <Select
                    label="Chế độ tính điểm"
                    value={normalizeStageScoringMode(entry?.scoringMode)}
                    onChange={(event) =>
                      setStageScoringPolicy((prev) => ({
                        ...prev,
                        [stageKey]: {
                          ...(prev?.[stageKey] || DEFAULT_STAGE_SCORING_ENTRY),
                          scoringMode: normalizeStageScoringMode(event.target.value),
                        },
                      }))
                    }
                  >
                    <MenuItem value={STAGE_SCORING_MODE.TRADITIONAL}>
                      {STAGE_SCORING_MODE_LABELS[STAGE_SCORING_MODE.TRADITIONAL]}
                    </MenuItem>
                    <MenuItem value={STAGE_SCORING_MODE.RALLY}>
                      {STAGE_SCORING_MODE_LABELS[STAGE_SCORING_MODE.RALLY]}
                    </MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Điểm mục tiêu"
                  value={entry?.targetPoints ?? 21}
                  disabled={!canManage}
                  onChange={(event) =>
                    setStageScoringPolicy((prev) => ({
                      ...prev,
                      [stageKey]: {
                        ...(prev?.[stageKey] || DEFAULT_STAGE_SCORING_ENTRY),
                        targetPoints: Math.max(1, Number(event.target.value) || 1),
                      },
                    }))
                  }
                  inputProps={{ min: 1 }}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Cách biệt (winBy)"
                  value={entry?.winBy ?? 2}
                  disabled={!canManage}
                  onChange={(event) =>
                    setStageScoringPolicy((prev) => ({
                      ...prev,
                      [stageKey]: {
                        ...(prev?.[stageKey] || DEFAULT_STAGE_SCORING_ENTRY),
                        winBy: Math.max(1, Number(event.target.value) || 1),
                      },
                    }))
                  }
                  inputProps={{ min: 1 }}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Đổi sân tại"
                  value={entry?.changeEndsAt ?? ""}
                  disabled={!canManage}
                  placeholder="vd. 6"
                  helperText="Để trống nếu không đổi sân theo điểm"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const nextValue =
                      raw === "" || raw == null
                        ? null
                        : Math.max(1, Number(raw) || 1);
                    setStageScoringPolicy((prev) => ({
                      ...prev,
                      [stageKey]: {
                        ...(prev?.[stageKey] || DEFAULT_STAGE_SCORING_ENTRY),
                        changeEndsAt: nextValue,
                      },
                    }));
                  }}
                  inputProps={{ min: 1 }}
                  fullWidth
                />
              </Stack>
            );
          })}
        </Stack>

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
            label="Số đội vượt bảng mỗi bảng (qualifiersPerGroup)"
            value={qualificationCount}
            disabled={!canManage || Number(groupCount) <= 1}
            onChange={(event) =>
              setQualificationCount(Math.max(1, Number(event.target.value) || 1))
            }
            inputProps={{ min: 1 }}
            fullWidth
            helperText={
              Number(groupCount) <= 1
                ? "1 bảng: kết thúc sau vòng tròn — không tạo knockout."
                : `Tổng vượt bảng = ${Math.max(1, Number(groupCount) || 1)} × ${Math.max(1, Number(qualificationCount) || 1)} (phải thuộc 2/4/8/16).`
            }
          />
          <FormControl fullWidth size="small" disabled={!canManage || Number(groupCount) <= 1}>
            <InputLabel>Knockout (multi-bảng)</InputLabel>
            <Select
              label="Knockout (multi-bảng)"
              value={knockoutFormat}
              onChange={(event) => setKnockoutFormat(event.target.value)}
            >
              <MenuItem value={KNOCKOUT_FORMAT.TOP_N}>Top N theo seed</MenuItem>
              <MenuItem value={KNOCKOUT_FORMAT.FINAL_ONLY}>Chung kết (top 2)</MenuItem>
              <MenuItem value={KNOCKOUT_FORMAT.SEMIFINALS}>Bán kết (top 4)</MenuItem>
            </Select>
          </FormControl>
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
