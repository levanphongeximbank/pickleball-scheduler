import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import RefreshIcon from "@mui/icons-material/Refresh";

import ClubSwitcher from "../../../components/ClubSwitcher.jsx";
import TenantSwitcher from "../../../components/TenantSwitcher.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { getPlayerCurrentRating } from "../../../models/player.js";
import {
  getExplicitTenantIdForClub,
  listClubsForTenant,
} from "../../tenant/index.js";
import SuperAdminFeatureGate from "../../pairing-constraints/components/SuperAdminFeatureGate.jsx";
import {
  activatePrivatePairingRuleSetWithPreflight,
  clonePrivatePairingRuleSetVersion,
  createPrivatePairingRule,
  createPrivatePairingRuleSet,
  disablePrivatePairingRule,
  getPrivatePairingRuleSet,
  isPrivatePairingRulesEnabled,
  listPrivatePairingAuditLogs,
  listPrivatePairingRuleSets,
  PRIVATE_PAIRING_SCOPE,
  rollbackPrivatePairingRuleSet,
  runPrivatePairingRuntime,
  SCOPES_REQUIRING_ID,
  updatePrivatePairingRule,
} from "../ui/privatePairingAdminApi.js";
import {
  CONSTRAINT_TYPE_LABELS,
  CONSTRAINT_TYPE_OPTIONS,
  emptyRuleDraft,
  filterRuleSets,
  filterRules,
  playerLabel,
  PRIORITY_OPTIONS,
  REASON_CATEGORY_OPTIONS,
  RELATION_MODE_OPTIONS,
  SCOPE_LABELS,
  SCOPE_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_CHIP_COLOR,
  VISIBILITY_OPTIONS,
} from "../ui/privatePairingAdminHelpers.js";

function errMsg(result) {
  return result?.message || result?.code || "Thao tác thất bại";
}

/** RPC always requires tenant_id — SYSTEM/GLOBAL without tenant is not allowed. */
const SYSTEM_SCOPE_ALLOWED_WITHOUT_TENANT = false;

const NO_CLUB_TENANT_MESSAGE = "Vui lòng chọn CLB trước khi tạo Rule Set.";
const NO_SOURCE_CLUB_MESSAGE = "Vui lòng chọn CLB nguồn trước.";
const NO_PLAYERS_IN_CLUB_MESSAGE = "CLB này chưa có vận động viên.";

function resolveAdminTenantId(currentTenantId, activeClubId) {
  const fromTenant = String(currentTenantId || "").trim();
  if (fromTenant) return fromTenant;
  const fromClub = String(getExplicitTenantIdForClub(activeClubId) || "").trim();
  return fromClub || null;
}

function resolveCreateScopeId(scopeType, formScopeId, resolvedTenantId, activeClubId) {
  const manual = String(formScopeId || "").trim();
  if (manual) return manual;

  if (scopeType === PRIVATE_PAIRING_SCOPE.CLUB) {
    // Product: CLB scope auto-fills scope_id from tenant context (no manual input).
    return String(resolvedTenantId || "").trim() || null;
  }
  if (scopeType === PRIVATE_PAIRING_SCOPE.TENANT) {
    return String(resolvedTenantId || "").trim() || null;
  }
  if (SCOPES_REQUIRING_ID.includes(scopeType)) {
    return String(activeClubId || "").trim() || null;
  }
  return null;
}

function buildPlayerOptions(players, clubId, clubName) {
  return (players || [])
    .map((player) => {
      const id = String(player?.id || "").trim();
      if (!id) return null;
      let rating = "—";
      try {
        const value = getPlayerCurrentRating(player, null);
        if (value != null && value !== "" && Number.isFinite(Number(value))) {
          rating = String(value);
        }
      } catch {
        /* ignore rating parse */
      }
      const name = String(player?.name || "").trim() || id;
      const clubLabel = clubName || clubId || "—";
      return {
        id,
        name,
        rating,
        clubId: clubId || null,
        clubName: clubLabel,
        label: `${name} · ${rating} · ${clubLabel}`,
      };
    })
    .filter(Boolean);
}

function RuleSetStatusChip({ status }) {
  const value = String(status || "draft");
  return <Chip size="small" label={value} color={STATUS_CHIP_COLOR[value] || "default"} />;
}

function PrivatePairingRulesAdminInner() {
  const { user } = useAuth();
  const { clubs, activeClubId } = useClub();
  const { currentTenantId } = useTenant();

  const [tab, setTab] = useState(0);
  const [ruleSets, setRuleSets] = useState([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState("");
  const [detail, setDetail] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [listScopeType, setListScopeType] = useState("");

  const [ruleSearch, setRuleSearch] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState("");
  const [ruleType, setRuleType] = useState("");
  const [ruleActiveOnly, setRuleActiveOnly] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    scopeType: "CLUB",
    scopeId: "",
    reason: "create-rule-set",
  });

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleDraft, setRuleDraft] = useState(emptyRuleDraft());
  /** GLOBAL rules: club used as player datasource only (not persisted as rule identity). */
  const [playerSourceClubId, setPlayerSourceClubId] = useState("");
  const [playerLoadTick, setPlayerLoadTick] = useState(0);

  const [actionReason, setActionReason] = useState("");
  const [simulatorOut, setSimulatorOut] = useState(null);

  const featureOn = isPrivatePairingRulesEnabled();

  const resolvedTenantId = useMemo(
    () => resolveAdminTenantId(currentTenantId, activeClubId),
    [currentTenantId, activeClubId]
  );

  /** SYSTEM == GLOBAL in scope enum. RPC still requires tenant_id. */
  const systemScopeAllowed =
    SYSTEM_SCOPE_ALLOWED_WITHOUT_TENANT || Boolean(resolvedTenantId);

  const createScopeId = useMemo(
    () =>
      resolveCreateScopeId(
        createForm.scopeType,
        createForm.scopeId,
        resolvedTenantId,
        activeClubId
      ),
    [createForm.scopeType, createForm.scopeId, resolvedTenantId, activeClubId]
  );

  const canCreateRuleSet =
    Boolean(resolvedTenantId) &&
    Boolean(String(createForm.name || "").trim()) &&
    (createForm.scopeType !== PRIVATE_PAIRING_SCOPE.GLOBAL || systemScopeAllowed) &&
    (!SCOPES_REQUIRING_ID.includes(createForm.scopeType) || Boolean(createScopeId));

  const sourceClubChoices = useMemo(() => {
    if (resolvedTenantId) {
      return listClubsForTenant(resolvedTenantId);
    }
    return Array.isArray(clubs) ? clubs : [];
  }, [resolvedTenantId, clubs]);

  const clubNameById = useMemo(() => {
    const map = new Map();
    for (const club of [...(clubs || []), ...sourceClubChoices]) {
      if (!club?.id) continue;
      map.set(String(club.id), club.name || club.id);
    }
    return map;
  }, [clubs, sourceClubChoices]);

  const selectedRuleSetMeta = detail?.ruleSet || detail?.rule_set || null;
  const selectedRuleSetScope = String(
    selectedRuleSetMeta?.scope_type || selectedRuleSetMeta?.scopeType || ""
  );
  const isGlobalRuleSet = selectedRuleSetScope === PRIVATE_PAIRING_SCOPE.GLOBAL;
  const isClubRuleSet = selectedRuleSetScope === PRIVATE_PAIRING_SCOPE.CLUB;

  const effectivePlayerClubId = useMemo(() => {
    if (isGlobalRuleSet) {
      return String(playerSourceClubId || "").trim() || null;
    }
    // CLUB (and non-GLOBAL): load from current/active club only — not whole platform.
    return String(activeClubId || "").trim() || null;
  }, [isGlobalRuleSet, playerSourceClubId, activeClubId]);

  const players = useMemo(() => {
    if (!effectivePlayerClubId) return [];
    try {
      return loadPlayersForClub(effectivePlayerClubId) || [];
    } catch {
      return [];
    }
  }, [effectivePlayerClubId, playerLoadTick]);

  const playersById = useMemo(
    () => new Map(players.map((p) => [String(p.id), p])),
    [players]
  );

  const playerOptions = useMemo(
    () =>
      buildPlayerOptions(
        players,
        effectivePlayerClubId,
        clubNameById.get(String(effectivePlayerClubId)) || effectivePlayerClubId
      ),
    [players, effectivePlayerClubId, clubNameById]
  );

  const targetPlayerOptions = useMemo(() => {
    const primaryId = String(ruleDraft.primaryPlayerId || "").trim();
    if (!primaryId) return playerOptions;
    return playerOptions.filter((option) => option.id !== primaryId);
  }, [playerOptions, ruleDraft.primaryPlayerId]);

  const primaryOptionSelected = useMemo(() => {
    const primaryId = String(ruleDraft.primaryPlayerId || "").trim();
    if (!primaryId) return null;
    return playerOptions.find((option) => option.id === primaryId) || null;
  }, [playerOptions, ruleDraft.primaryPlayerId]);

  const targetOptionsSelected = useMemo(() => {
    const ids = new Set((ruleDraft.targetPlayerIds || []).map(String));
    return targetPlayerOptions.filter((option) => ids.has(option.id));
  }, [targetPlayerOptions, ruleDraft.targetPlayerIds]);

  const playerSelectorEmptyMessage = !effectivePlayerClubId
    ? isGlobalRuleSet
      ? NO_SOURCE_CLUB_MESSAGE
      : NO_CLUB_TENANT_MESSAGE
    : playerOptions.length === 0
      ? NO_PLAYERS_IN_CLUB_MESSAGE
      : null;

  const canSaveRule = Boolean(
    selectedRuleSetId &&
      effectivePlayerClubId &&
      primaryOptionSelected &&
      targetOptionsSelected.length > 0 &&
      !(ruleDraft.severity === "soft" &&
        (ruleDraft.weight === "" || Number.isNaN(Number(ruleDraft.weight))))
  );

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPrivatePairingRuleSets({
      scopeType: listScopeType || null,
      status: listStatus || null,
    });
    setLoading(false);
    if (!result.ok) {
      setError(errMsg(result));
      setRuleSets([]);
      return;
    }
    setRuleSets(Array.isArray(result.rule_sets) ? result.rule_sets : result.ruleSets || []);
  }, [listScopeType, listStatus]);

  const refreshDetail = useCallback(async (ruleSetId) => {
    if (!ruleSetId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getPrivatePairingRuleSet(ruleSetId);
    setLoading(false);
    if (!result.ok) {
      setError(errMsg(result));
      setDetail(null);
      return;
    }
    setDetail(result);
  }, []);

  const refreshAudit = useCallback(async (ruleSetId) => {
    const result = await listPrivatePairingAuditLogs({ ruleSetId: ruleSetId || null });
    if (!result.ok) {
      setAuditLogs([]);
      return;
    }
    setAuditLogs(Array.isArray(result.logs) ? result.logs : result.audit_logs || []);
  }, []);

  useEffect(() => {
    if (featureOn) refreshList();
  }, [featureOn, refreshList]);

  useEffect(() => {
    if (!resolvedTenantId) return;
    if (error && /tenant_id\s*required/i.test(String(error))) {
      setError(null);
    }
  }, [resolvedTenantId, error]);

  useEffect(() => {
    if (!createOpen) return;
    if (createForm.scopeType !== PRIVATE_PAIRING_SCOPE.CLUB) return;
    if (String(createForm.scopeId || "").trim()) return;
    if (!resolvedTenantId) return;
    setCreateForm((f) => ({ ...f, scopeId: resolvedTenantId }));
  }, [createOpen, createForm.scopeType, createForm.scopeId, resolvedTenantId]);

  useEffect(() => {
    if (selectedRuleSetId) {
      refreshDetail(selectedRuleSetId);
      refreshAudit(selectedRuleSetId);
    }
  }, [selectedRuleSetId, refreshDetail, refreshAudit]);

  const filteredRuleSets = useMemo(
    () =>
      filterRuleSets(ruleSets, {
        search: listSearch,
        status: listStatus,
        scopeType: listScopeType,
      }),
    [ruleSets, listSearch, listStatus, listScopeType]
  );

  const activeVersionForScope = useMemo(() => {
    const rs = detail?.ruleSet || detail?.rule_set;
    if (!rs) return null;
    const scopeType = rs.scope_type || rs.scopeType;
    const scopeId = rs.scope_id || rs.scopeId || null;
    return (
      ruleSets.find(
        (item) =>
          String(item.status) === "active" &&
          String(item.scope_type || item.scopeType) === String(scopeType) &&
          String(item.scope_id ?? item.scopeId ?? "") === String(scopeId ?? "")
      ) || null
    );
  }, [detail, ruleSets]);

  const rules = useMemo(() => detail?.rules || [], [detail]);
  const dbRules = useMemo(() => detail?.dbRules || [], [detail]);
  const filteredRules = useMemo(
    () =>
      filterRules(rules, {
        search: ruleSearch,
        severity: ruleSeverity,
        constraintType: ruleType,
        activeOnly: ruleActiveOnly,
      }),
    [rules, ruleSearch, ruleSeverity, ruleType, ruleActiveOnly]
  );

  const isDraft = String(selectedRuleSetMeta?.status || "") === "draft";

  const resolveDefaultSourceClubId = useCallback(() => {
    const active = String(activeClubId || "").trim();
    if (active && sourceClubChoices.some((club) => String(club.id) === active)) {
      return active;
    }
    return "";
  }, [activeClubId, sourceClubChoices]);

  const openCreateRule = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyRuleDraft());
    setPlayerSourceClubId(isGlobalRuleSet ? resolveDefaultSourceClubId() : String(activeClubId || ""));
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule) => {
    const db = dbRules.find((r) => String(r.id) === String(rule.id));
    setEditingRuleId(rule.id);
    setPlayerSourceClubId(isGlobalRuleSet ? resolveDefaultSourceClubId() : String(activeClubId || ""));
    setRuleDraft({
      primaryPlayerId: String(rule.primaryPlayerId || ""),
      constraintType: rule.constraintType,
      severity: rule.severity || "hard",
      weight: rule.weight == null ? "" : String(rule.weight),
      priority: rule.priority || "medium",
      relationMode: rule.relationMode || "ANY_OF",
      targetPlayerIds: (rule.targetPlayerIds || []).map(String),
      reasonCategory: rule.reasonCategory || "OTHER",
      reasonText: rule.reasonText || "",
      visibility: rule.visibility || "private",
      startAt: rule.startAt ? String(rule.startAt).slice(0, 16) : "",
      endAt: rule.endAt ? String(rule.endAt).slice(0, 16) : "",
      reason: "update-rule",
      _dbId: db?.id || rule.id,
    });
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedRuleSetId) return;
    if (!effectivePlayerClubId) {
      setError(isGlobalRuleSet ? NO_SOURCE_CLUB_MESSAGE : NO_CLUB_TENANT_MESSAGE);
      return;
    }
    if (!primaryOptionSelected) {
      setError("Chọn VĐV chính từ danh sách (player_id).");
      return;
    }
    const targets = targetOptionsSelected.map((option) => option.id);
    if (!targets.length) {
      setError("Chọn ít nhất một target player từ danh sách.");
      return;
    }
    if (targets.includes(primaryOptionSelected.id)) {
      setError("Target không được trùng VĐV chính.");
      return;
    }
    if (ruleDraft.severity === "soft" && (ruleDraft.weight === "" || Number.isNaN(Number(ruleDraft.weight)))) {
      setError("Soft rule cần weight hợp lệ.");
      return;
    }
    setError(null);
    setMessage(null);
    const payloadBase = {
      primaryPlayerId: primaryOptionSelected.id,
      constraintType: ruleDraft.constraintType,
      severity: ruleDraft.severity,
      weight: ruleDraft.severity === "soft" ? Number(ruleDraft.weight) : null,
      priority: ruleDraft.priority,
      relationMode: ruleDraft.relationMode,
      targetPlayerIds: targets,
      reasonCategory: ruleDraft.reasonCategory,
      reasonText: ruleDraft.reasonText || null,
      visibility: ruleDraft.visibility,
      startAt: ruleDraft.startAt || null,
      endAt: ruleDraft.endAt || null,
      reason: ruleDraft.reason || (editingRuleId ? "update-rule" : "create-rule"),
    };

    let result;
    if (editingRuleId) {
      result = await updatePrivatePairingRule({
        ruleId: editingRuleId,
        ...payloadBase,
        clearTimeRange: !ruleDraft.startAt && !ruleDraft.endAt,
      });
    } else {
      result = await createPrivatePairingRule({
        ruleSetId: selectedRuleSetId,
        ...payloadBase,
      });
    }
    if (!result.ok) {
      setError(errMsg(result));
      return;
    }
    setRuleDialogOpen(false);
    setMessage(editingRuleId ? "Đã cập nhật rule." : "Đã thêm rule.");
    await refreshDetail(selectedRuleSetId);
    await refreshAudit(selectedRuleSetId);
  };

  const handleDisableRule = async (ruleId) => {
    const reason = window.prompt("Lý do vô hiệu hóa / xóa mềm rule:", "disable-rule");
    if (!reason) return;
    const result = await disablePrivatePairingRule({ ruleId, reason });
    if (!result.ok) {
      setError(errMsg(result));
      return;
    }
    setMessage("Đã vô hiệu hóa rule (soft delete — không hard delete).");
    await refreshDetail(selectedRuleSetId);
    await refreshAudit(selectedRuleSetId);
  };

  const openCreateDialog = () => {
    setCreateForm({
      name: "",
      description: "",
      scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
      scopeId: resolvedTenantId || "",
      reason: "create-rule-set",
    });
    setCreateOpen(true);
  };

  const handleCreateRuleSet = async () => {
    setError(null);
    if (!resolvedTenantId) {
      setError(NO_CLUB_TENANT_MESSAGE);
      return;
    }
    if (
      createForm.scopeType === PRIVATE_PAIRING_SCOPE.GLOBAL &&
      !systemScopeAllowed
    ) {
      setError(
        "Scope GLOBAL (toàn hệ thống) không dùng được khi thiếu tenant_id. Chọn CLB/tenant trước."
      );
      return;
    }

    const scopeId = resolveCreateScopeId(
      createForm.scopeType,
      createForm.scopeId,
      resolvedTenantId,
      activeClubId
    );
    if (SCOPES_REQUIRING_ID.includes(createForm.scopeType) && !scopeId) {
      setError(NO_CLUB_TENANT_MESSAGE);
      return;
    }

    const result = await createPrivatePairingRuleSet({
      name: createForm.name,
      description: createForm.description || null,
      scopeType: createForm.scopeType,
      scopeId:
        createForm.scopeType === PRIVATE_PAIRING_SCOPE.GLOBAL ? null : scopeId,
      tenantId: resolvedTenantId,
      reason: createForm.reason || "create-rule-set",
    });
    if (!result.ok) {
      setError(errMsg(result));
      return;
    }
    setCreateOpen(false);
    setMessage("Đã tạo Rule Set (draft).");
    await refreshList();
    const newId = result.rule_set?.id || result.ruleSet?.id;
    if (newId) setSelectedRuleSetId(newId);
  };

  const handleClone = async () => {
    if (!selectedRuleSetId) return;
    const reason = actionReason || "clone-version";
    const result = await clonePrivatePairingRuleSetVersion({
      sourceRuleSetId: selectedRuleSetId,
      reason,
    });
    if (!result.ok) {
      setError(errMsg(result));
      return;
    }
    setMessage("Đã clone version (draft mới).");
    await refreshList();
    const newId = result.rule_set?.id || result.ruleSet?.id;
    if (newId) setSelectedRuleSetId(newId);
  };

  const handleActivate = async () => {
    if (!selectedRuleSetId) return;
    const reason = actionReason || "activate-version";
    const result = await activatePrivatePairingRuleSetWithPreflight({
      ruleSetId: selectedRuleSetId,
      reason,
      context: { teamSize: 2 },
    });
    if (!result.ok) {
      setError(errMsg(result));
      return;
    }
    setMessage("Đã activate version.");
    await refreshList();
    await refreshDetail(selectedRuleSetId);
    await refreshAudit(selectedRuleSetId);
  };

  const handleRollback = async () => {
    if (!selectedRuleSetId) return;
    const reason = actionReason || "rollback-version";
    if (!window.confirm("Rollback sẽ tạo draft từ version nguồn. Tiếp tục?")) return;
    const result = await rollbackPrivatePairingRuleSet({
      sourceRuleSetId: selectedRuleSetId,
      reason,
    });
    if (!result.ok) {
      setError(errMsg(result));
      return;
    }
    setMessage("Đã rollback (draft mới).");
    await refreshList();
    const newId = result.rule_set?.id || result.ruleSet?.id;
    if (newId) setSelectedRuleSetId(newId);
  };

  const handleSimulate = () => {
    const sample = players.slice(0, 8);
    if (sample.length < 4) {
      setSimulatorOut({
        ok: false,
        message: "Cần ≥4 VĐV trong CLB đang chọn để mô phỏng.",
      });
      return;
    }
    const result = runPrivatePairingRuntime({
      players: sample,
      rules: rules.filter((r) => r.active !== false),
      teamSize: 2,
      maxTeams: 2,
    });
    setSimulatorOut(result);
  };

  if (!featureOn) {
    return (
      <Alert severity="warning">
        Feature flag <code>VITE_PRIVATE_PAIRING_RULES_ENABLED</code> đang tắt. Bật flag để dùng UI.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <AdminPanelSettingsIcon color="warning" />
        <Typography variant="h5" fontWeight={700}>
          Quy tắc ghép cặp riêng
        </Typography>
        <Chip size="small" color="warning" label="SUPER_ADMIN" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chỉ SUPER_ADMIN. Mọi thao tác qua RPC PR-4 — không truy cập trực tiếp bảng.
        Actor: {user?.email || user?.id || "—"}.
      </Typography>

      {!resolvedTenantId ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {NO_CLUB_TENANT_MESSAGE}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TenantSwitcher variant="context" minWidth={220} />
            <ClubSwitcher variant="context" minWidth={200} />
          </Stack>
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 1 }}>
          Tenant: <code>{resolvedTenantId}</code>
          {activeClubId ? (
            <>
              {" "}
              · CLB: <code>{activeClubId}</code>
            </>
          ) : null}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 1 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            label="Tìm Rule Set"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={listStatus}
              onChange={(e) => setListStatus(e.target.value)}
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="draft">draft</MenuItem>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="archived">archived</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Scope</InputLabel>
            <Select
              label="Scope"
              value={listScopeType}
              onChange={(e) => setListScopeType(e.target.value)}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {SCOPE_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {SCOPE_LABELS[s] || s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button startIcon={<RefreshIcon />} onClick={refreshList} disabled={loading}>
            Làm mới
          </Button>
          <Button
            variant="contained"
            onClick={openCreateDialog}
            disabled={!resolvedTenantId}
          >
            Tạo Rule Set
          </Button>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 280, maxHeight: 480, overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Ver</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRuleSets.map((rs) => {
                const id = rs.id;
                const selected = id === selectedRuleSetId;
                return (
                  <TableRow
                    key={id}
                    hover
                    selected={selected}
                    sx={{ cursor: "pointer" }}
                    onClick={() => setSelectedRuleSetId(id)}
                  >
                    <TableCell>{rs.name}</TableCell>
                    <TableCell>{rs.version}</TableCell>
                    <TableCell>
                      {SCOPE_LABELS[rs.scope_type || rs.scopeType] || rs.scope_type}
                      {(rs.scope_id || rs.scopeId) && (
                        <Typography variant="caption" display="block">
                          {rs.scope_id || rs.scopeId}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <RuleSetStatusChip status={rs.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredRuleSets.length && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">
                      Không có Rule Set.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        <Paper variant="outlined" sx={{ flex: 2, p: 1.5 }}>
          {!selectedRuleSetId || !selectedRuleSetMeta ? (
            <Typography color="text.secondary">Chọn một Rule Set để quản lý Rules.</Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography variant="h6">{selectedRuleSetMeta.name}</Typography>
                <Chip size="small" label={`v${selectedRuleSetMeta.version}`} />
                <RuleSetStatusChip status={selectedRuleSetMeta.status} />
                {activeVersionForScope && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={`Active scope: v${activeVersionForScope.version}`}
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Scope: {SCOPE_LABELS[selectedRuleSetMeta.scope_type || selectedRuleSetMeta.scopeType]}{" "}
                · ID: {selectedRuleSetMeta.scope_id || selectedRuleSetMeta.scopeId || "—"} ·{" "}
                {selectedRuleSetMeta.id}
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  label="Lý do thao tác version"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <Button onClick={handleClone}>Clone Version</Button>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!isDraft}
                  onClick={handleActivate}
                >
                  Activate Version
                </Button>
                <Button color="warning" onClick={handleRollback}>
                  Rollback Version
                </Button>
              </Stack>

              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
                <Tab label="Rules" />
                <Tab label="Audit Logs" />
                <Tab label="Mô phỏng" />
              </Tabs>

              {tab === 0 && (
                <>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      label="Tìm rule / VĐV"
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                    />
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Hard/Soft</InputLabel>
                      <Select
                        label="Hard/Soft"
                        value={ruleSeverity}
                        onChange={(e) => setRuleSeverity(e.target.value)}
                      >
                        <MenuItem value="">Tất cả</MenuItem>
                        {SEVERITY_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Loại</InputLabel>
                      <Select
                        label="Loại"
                        value={ruleType}
                        onChange={(e) => setRuleType(e.target.value)}
                      >
                        <MenuItem value="">Tất cả</MenuItem>
                        {CONSTRAINT_TYPE_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {CONSTRAINT_TYPE_LABELS[t] || t}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Active</InputLabel>
                      <Select
                        label="Active"
                        value={ruleActiveOnly ? "1" : "0"}
                        onChange={(e) => setRuleActiveOnly(e.target.value === "1")}
                      >
                        <MenuItem value="1">Chỉ active</MenuItem>
                        <MenuItem value="0">Tất cả</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      disabled={!isDraft}
                      onClick={openCreateRule}
                    >
                      Thêm Rule
                    </Button>
                  </Stack>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>VĐV chính</TableCell>
                        <TableCell>Loại</TableCell>
                        <TableCell>Targets</TableCell>
                        <TableCell>Mức</TableCell>
                        <TableCell>Trạng thái</TableCell>
                        <TableCell align="right">Thao tác</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            {playerLabel(playersById, rule.primaryPlayerId)}
                          </TableCell>
                          <TableCell>
                            {CONSTRAINT_TYPE_LABELS[rule.constraintType] || rule.constraintType}
                          </TableCell>
                          <TableCell>
                            {(rule.targetPlayerIds || [])
                              .map((id) => playerLabel(playersById, id))
                              .join(", ") || "—"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={rule.severity}
                              color={rule.severity === "hard" ? "error" : "info"}
                            />
                            {rule.severity === "soft" && rule.weight != null
                              ? ` w=${rule.weight}`
                              : ""}
                          </TableCell>
                          <TableCell>
                            {rule.active === false ? (
                              <Chip size="small" label="disabled" />
                            ) : (
                              <Chip size="small" color="success" label="active" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              disabled={!isDraft}
                              onClick={() => openEditRule(rule)}
                            >
                              Sửa
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              disabled={!isDraft || rule.active === false}
                              onClick={() => handleDisableRule(rule.id)}
                            >
                              Disable
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!filteredRules.length && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography variant="body2" color="text.secondary">
                              Chưa có rule.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {!isDraft && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Rule Set không phải draft — chỉ xem. Clone để chỉnh sửa.
                    </Alert>
                  )}
                </>
              )}

              {tab === 1 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Thời gian</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Actor</TableCell>
                      <TableCell>Rule</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.map((log, idx) => (
                      <TableRow key={log.id || idx}>
                        <TableCell>{log.created_at || log.createdAt || "—"}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.actor_user_id || log.actorUserId || "—"}</TableCell>
                        <TableCell>{log.rule_id || log.ruleId || "—"}</TableCell>
                        <TableCell>{log.reason || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!auditLogs.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            Chưa có audit log.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {tab === 2 && (
                <Box>
                  <Button variant="outlined" onClick={handleSimulate}>
                    Mô phỏng ghép cặp
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Dùng rules đang load + VĐV CLB active (in-memory runtime PR-3). Không ghi DB.
                  </Typography>
                  {simulatorOut && (
                    <Box
                      component="pre"
                      sx={{
                        mt: 1,
                        p: 1,
                        bgcolor: "action.hover",
                        overflow: "auto",
                        maxHeight: 320,
                        fontSize: 12,
                      }}
                    >
                      {JSON.stringify(simulatorOut, null, 2)}
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}
        </Paper>
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tạo Rule Set</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {!resolvedTenantId && (
              <Alert severity="warning">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {NO_CLUB_TENANT_MESSAGE}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TenantSwitcher variant="context" minWidth={220} />
                  <ClubSwitcher variant="context" minWidth={200} />
                </Stack>
              </Alert>
            )}
            <TextField
              label="Tên"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Mô tả"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Scope</InputLabel>
              <Select
                label="Scope"
                value={createForm.scopeType}
                onChange={(e) => {
                  const nextScope = e.target.value;
                  setCreateForm((f) => ({
                    ...f,
                    scopeType: nextScope,
                    scopeId:
                      nextScope === PRIVATE_PAIRING_SCOPE.CLUB ||
                      nextScope === PRIVATE_PAIRING_SCOPE.TENANT
                        ? f.scopeId || resolvedTenantId || ""
                        : nextScope === PRIVATE_PAIRING_SCOPE.GLOBAL
                          ? ""
                          : f.scopeId,
                  }));
                }}
              >
                {SCOPE_OPTIONS.map((s) => {
                  const isSystemScope = s === PRIVATE_PAIRING_SCOPE.GLOBAL;
                  const disabled = isSystemScope && !systemScopeAllowed;
                  return (
                    <MenuItem key={s} value={s} disabled={disabled}>
                      {SCOPE_LABELS[s] || s}
                      {disabled
                        ? " — cần chọn CLB/tenant (RPC bắt buộc tenant_id)"
                        : ""}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {!systemScopeAllowed && (
              <Alert severity="info">
                Scope GLOBAL (toàn hệ thống / SYSTEM) không khả dụng khi thiếu tenant —
                RPC PR-4 luôn yêu cầu <code>tenant_id</code>. Chọn CLB hoặc tenant trước.
              </Alert>
            )}
            {createForm.scopeType === PRIVATE_PAIRING_SCOPE.CLUB ? (
              <TextField
                label="Scope ID (CLB)"
                value={createScopeId || ""}
                helperText="Tự điền từ tenant đang chọn — không cần nhập tay."
                fullWidth
                InputProps={{ readOnly: true }}
              />
            ) : createForm.scopeType !== PRIVATE_PAIRING_SCOPE.GLOBAL ? (
              <TextField
                label="Scope ID"
                helperText={
                  SCOPES_REQUIRING_ID.includes(createForm.scopeType)
                    ? `Bắt buộc — gợi ý: ${createScopeId || activeClubId || resolvedTenantId || "—"}`
                    : "Tùy scope"
                }
                value={createForm.scopeId}
                onChange={(e) => setCreateForm((f) => ({ ...f, scopeId: e.target.value }))}
                fullWidth
              />
            ) : null}
            <TextField
              label="Tenant ID"
              value={resolvedTenantId || ""}
              helperText={
                resolvedTenantId
                  ? "Tự lấy từ tenant / CLB đang chọn."
                  : NO_CLUB_TENANT_MESSAGE
              }
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Lý do audit"
              value={createForm.reason}
              onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreateRuleSet} disabled={!canCreateRuleSet}>
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingRuleId ? "Sửa Rule" : "Thêm Rule"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {isGlobalRuleSet ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <FormControl fullWidth required>
                  <InputLabel>CLB nguồn</InputLabel>
                  <Select
                    label="CLB nguồn"
                    value={
                      sourceClubChoices.some(
                        (club) => String(club.id) === String(playerSourceClubId)
                      )
                        ? playerSourceClubId
                        : ""
                    }
                    onChange={(e) => {
                      const nextClubId = e.target.value;
                      setPlayerSourceClubId(nextClubId);
                      setRuleDraft((d) => ({
                        ...d,
                        primaryPlayerId: "",
                        targetPlayerIds: [],
                      }));
                    }}
                  >
                    <MenuItem value="" disabled>
                      <em>Chọn CLB nguồn…</em>
                    </MenuItem>
                    {sourceClubChoices.map((club) => (
                      <MenuItem key={club.id} value={club.id}>
                        {club.name || club.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  disabled={!playerSourceClubId}
                  onClick={() => setPlayerLoadTick((n) => n + 1)}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Tải lại VĐV
                </Button>
              </Stack>
            ) : (
              <Alert severity="info">
                {isClubRuleSet ? "Scope CLB" : `Scope ${selectedRuleSetScope || "—"}`}
                {" — "}
                nguồn VĐV:{" "}
                <strong>
                  {clubNameById.get(String(activeClubId)) || activeClubId || "—"}
                </strong>
                . Đổi CLB ở header/context nếu cần.
              </Alert>
            )}

            {playerSelectorEmptyMessage && (
              <Alert severity="warning">{playerSelectorEmptyMessage}</Alert>
            )}

            <Autocomplete
              options={playerOptions}
              getOptionLabel={(o) => o.label || `${o.name} · ${o.rating} · ${o.clubName}`}
              isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
              value={primaryOptionSelected}
              onChange={(_, v) =>
                setRuleDraft((d) => {
                  const nextPrimary = v?.id || "";
                  return {
                    ...d,
                    primaryPlayerId: nextPrimary,
                    targetPlayerIds: (d.targetPlayerIds || []).filter(
                      (id) => String(id) !== String(nextPrimary)
                    ),
                  };
                })
              }
              disabled={!effectivePlayerClubId || playerOptions.length === 0}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Rating {option.rating} · {option.clubName}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="VĐV chính (primary)"
                  required
                  helperText="Chỉ chọn từ danh sách — lưu player_id, không lưu tên/email."
                />
              )}
            />
            <FormControl fullWidth>
              <InputLabel>Loại quy tắc</InputLabel>
              <Select
                label="Loại quy tắc"
                value={ruleDraft.constraintType}
                onChange={(e) => setRuleDraft((d) => ({ ...d, constraintType: e.target.value }))}
              >
                {CONSTRAINT_TYPE_OPTIONS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {CONSTRAINT_TYPE_LABELS[t] || t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={targetPlayerOptions}
              getOptionLabel={(o) => o.label || `${o.name} · ${o.rating} · ${o.clubName}`}
              isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
              value={targetOptionsSelected}
              onChange={(_, v) => {
                const unique = [];
                const seen = new Set();
                for (const option of v || []) {
                  const id = String(option?.id || "").trim();
                  if (!id || seen.has(id)) continue;
                  if (id === String(ruleDraft.primaryPlayerId || "")) continue;
                  seen.add(id);
                  unique.push(id);
                }
                setRuleDraft((d) => ({ ...d, targetPlayerIds: unique }));
              }}
              disabled={!effectivePlayerClubId || targetPlayerOptions.length === 0}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Rating {option.rating} · {option.clubName}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Target players"
                  required
                  helperText="Multi-select · cùng nguồn CLB · loại trừ VĐV chính · lưu player_id."
                />
              )}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  label="Severity"
                  value={ruleDraft.severity}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, severity: e.target.value }))}
                >
                  {SEVERITY_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Weight (soft)"
                type="number"
                disabled={ruleDraft.severity !== "soft"}
                value={ruleDraft.weight}
                onChange={(e) => setRuleDraft((d) => ({ ...d, weight: e.target.value }))}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Relation</InputLabel>
                <Select
                  label="Relation"
                  value={ruleDraft.relationMode}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, relationMode: e.target.value }))}
                >
                  {RELATION_MODE_OPTIONS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={ruleDraft.priority}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Visibility</InputLabel>
                <Select
                  label="Visibility"
                  value={ruleDraft.visibility}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, visibility: e.target.value }))}
                >
                  {VISIBILITY_OPTIONS.map((v) => (
                    <MenuItem key={v} value={v}>
                      {v}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Reason category</InputLabel>
                <Select
                  label="Reason category"
                  value={ruleDraft.reasonCategory}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, reasonCategory: e.target.value }))}
                >
                  {REASON_CATEGORY_OPTIONS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Reason text"
              value={ruleDraft.reasonText}
              onChange={(e) => setRuleDraft((d) => ({ ...d, reasonText: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Start (local)"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={ruleDraft.startAt}
                onChange={(e) => setRuleDraft((d) => ({ ...d, startAt: e.target.value }))}
                fullWidth
              />
              <TextField
                label="End (local)"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={ruleDraft.endAt}
                onChange={(e) => setRuleDraft((d) => ({ ...d, endAt: e.target.value }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Audit reason"
              value={ruleDraft.reason}
              onChange={(e) => setRuleDraft((d) => ({ ...d, reason: e.target.value }))}
              fullWidth
            />
            <Divider />
            <Alert severity="info">
              Hard delete bị cấm trên DB (PR-4). Disable = soft delete. Target players chỉnh trong
              form này rồi lưu qua RPC update/create. Relation key = player_id (không phải email/tên).
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveRule} disabled={!canSaveRule}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * SUPER_ADMIN-only Private Pairing Rules admin (PR-5).
 * Fail-closed when RBAC off or non–super-admin.
 */
export default function PrivatePairingRulesAdminView() {
  return (
    <SuperAdminFeatureGate
      fallback={
        <Alert severity="error" sx={{ m: 2 }}>
          Chỉ SUPER_ADMIN mới được xem và quản lý Private Pairing Rules.
        </Alert>
      }
    >
      <PrivatePairingRulesAdminInner />
    </SuperAdminFeatureGate>
  );
}
