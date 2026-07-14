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

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import SuperAdminFeatureGate from "../../pairing-constraints/components/SuperAdminFeatureGate.jsx";
import { getExplicitTenantIdForClub } from "../../tenant/index.js";
import {
  activatePrivatePairingRuleSetWithPreflight,
  canAuditPrivatePairingRules,
  canManagePrivatePairingRules,
  canSimulatePrivatePairingRules,
  clonePrivatePairingRuleSetVersion,
  createPrivatePairingRule,
  createPrivatePairingRuleSet,
  detectPrivatePairingConflicts,
  disablePrivatePairingRule,
  getPrivatePairingRuleSet,
  isPrivatePairingRulesEnabled,
  isPrivatePairingSimulationEnabled,
  listPrivatePairingAuditLogs,
  listPrivatePairingRuleSets,
  PRIVATE_PAIRING_SCOPE,
  rollbackPrivatePairingRuleSet,
  SCOPES_REQUIRING_ID,
  updatePrivatePairingRule,
} from "../ui/privatePairingAdminApi.js";
import {
  CONSTRAINT_TYPE_GROUPS,
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
import {
  assertPairingPlayerIdsAreCanonical,
  privatePairingPlayerPickerAdapter,
  PRIVATE_PAIRING_PICKER_MESSAGES,
} from "../ui/privatePairingPlayerPickerAdapter.js";
import PrivatePairingRuleSetList from "./panels/PrivatePairingRuleSetList.jsx";
import PrivatePairingConflictPanel from "./panels/PrivatePairingConflictPanel.jsx";
import PrivatePairingSimulationPanel from "./panels/PrivatePairingSimulationPanel.jsx";
import PrivatePairingAuditLog from "./panels/PrivatePairingAuditLog.jsx";
import PrivatePairingVersionHistory from "./panels/PrivatePairingVersionHistory.jsx";

function errMsg(result) {
  return result?.message || result?.code || "Thao tác thất bại";
}

/** Resolve tenant_id for RPC — never confuse with club_id. */
function resolveAdminTenantId(currentTenantId, activeClubId) {
  const fromTenant = String(currentTenantId || "").trim();
  if (fromTenant) return fromTenant;
  return String(getExplicitTenantIdForClub(activeClubId) || "").trim() || null;
}

/** CLUB scope_id must be club_id — never tenant/venue id. */
function resolveCreateScopeId(scopeType, formScopeId, activeClubId) {
  const manual = String(formScopeId || "").trim();
  if (manual) return manual;
  if (scopeType === PRIVATE_PAIRING_SCOPE.CLUB) {
    return String(activeClubId || "").trim() || null;
  }
  if (SCOPES_REQUIRING_ID.includes(scopeType)) {
    return String(activeClubId || "").trim() || null;
  }
  return null;
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

  const [actionReason, setActionReason] = useState("");
  const [conflictResult, setConflictResult] = useState(null);

  const [playerSourceClubId, setPlayerSourceClubId] = useState("");
  const [playerLoadTick, setPlayerLoadTick] = useState(0);
  const [sourceClubChoices, setSourceClubChoices] = useState([]);
  const [playerOptions, setPlayerOptions] = useState([]);
  const [pickerWarnings, setPickerWarnings] = useState([]);
  const [pickerMappingSummary, setPickerMappingSummary] = useState(null);
  const [playerSelectorEmptyMessage, setPlayerSelectorEmptyMessage] = useState(null);

  const featureOn = isPrivatePairingRulesEnabled();
  const simulationFlagOn = isPrivatePairingSimulationEnabled();
  const canManage = canManagePrivatePairingRules(user);
  const canAudit = canAuditPrivatePairingRules(user);
  const canSimulate = canSimulatePrivatePairingRules(user);
  const resolvedTenantId = useMemo(
    () => resolveAdminTenantId(currentTenantId, activeClubId),
    [currentTenantId, activeClubId]
  );

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
    return String(activeClubId || "").trim() || null;
  }, [isGlobalRuleSet, playerSourceClubId, activeClubId]);

  const clubNameById = useMemo(() => {
    const map = new Map();
    for (const club of [...(clubs || []), ...sourceClubChoices]) {
      if (!club?.id) continue;
      map.set(String(club.id), club.name || club.id);
    }
    return map;
  }, [clubs, sourceClubChoices]);

  const playersById = useMemo(
    () => new Map(playerOptions.map((p) => [String(p.id), { id: p.id, name: p.name }])),
    [playerOptions]
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

  const canSaveRule = Boolean(
    selectedRuleSetId &&
      effectivePlayerClubId &&
      primaryOptionSelected &&
      targetOptionsSelected.length > 0 &&
      !(
        ruleDraft.severity === "soft" &&
        (ruleDraft.weight === "" || Number.isNaN(Number(ruleDraft.weight)))
      )
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await privatePairingPlayerPickerAdapter.listSourceClubs({
        tenantId: resolvedTenantId,
        userContext: { user, isPlatformAdmin: true },
      });
      if (cancelled) return;
      if (result.ok) {
        setSourceClubChoices(Array.isArray(result.data) ? result.data : []);
      } else {
        setSourceClubChoices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedTenantId, user, playerLoadTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectivePlayerClubId) {
        setPlayerOptions([]);
        setPickerWarnings([]);
        setPickerMappingSummary(null);
        setPlayerSelectorEmptyMessage(
          isGlobalRuleSet
            ? PRIVATE_PAIRING_PICKER_MESSAGES.NO_SOURCE_CLUB_MESSAGE
            : PRIVATE_PAIRING_PICKER_MESSAGES.NO_CLUB_MESSAGE
        );
        return;
      }
      const result = await privatePairingPlayerPickerAdapter.listPickerPlayers({
        clubId: effectivePlayerClubId,
        tenantId: resolvedTenantId,
        userContext: { user, isPlatformAdmin: true },
      });
      if (cancelled) return;
      if (!result.ok) {
        setPlayerOptions([]);
        setPickerWarnings(result.warnings || []);
        setPickerMappingSummary(null);
        setPlayerSelectorEmptyMessage(result.message || errMsg(result));
        return;
      }
      setPlayerOptions(result.options || []);
      setPickerWarnings(result.warnings || []);
      setPickerMappingSummary(result.mappingSummary || null);
      setPlayerSelectorEmptyMessage(result.emptyMessage || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [effectivePlayerClubId, resolvedTenantId, user, playerLoadTick, isGlobalRuleSet]);

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
    return String(sourceClubChoices[0]?.id || "").trim();
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
    setPlayerSourceClubId(isGlobalRuleSet ? resolveDefaultSourceClubId() : String(activeClubId || ""));
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedRuleSetId) return;
    if (!effectivePlayerClubId) {
      setError(
        isGlobalRuleSet
          ? PRIVATE_PAIRING_PICKER_MESSAGES.NO_SOURCE_CLUB_MESSAGE
          : PRIVATE_PAIRING_PICKER_MESSAGES.NO_CLUB_MESSAGE
      );
      return;
    }
    const idCheck = assertPairingPlayerIdsAreCanonical(ruleDraft, playerOptions);
    if (!idCheck.ok) {
      setError(idCheck.message || idCheck.code);
      return;
    }
    if (ruleDraft.severity === "soft" && (ruleDraft.weight === "" || Number.isNaN(Number(ruleDraft.weight)))) {
      setError("Soft rule cần weight hợp lệ.");
      return;
    }
    setError(null);
    setMessage(null);
    const payloadBase = {
      primaryPlayerId: idCheck.primaryPlayerId,
      constraintType: ruleDraft.constraintType,
      severity: ruleDraft.severity,
      weight: ruleDraft.severity === "soft" ? Number(ruleDraft.weight) : null,
      priority: ruleDraft.priority,
      relationMode: ruleDraft.relationMode,
      targetPlayerIds: idCheck.targetPlayerIds,
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

  const handleCreateRuleSet = async () => {
    setError(null);
    const scopeId = resolveCreateScopeId(
      createForm.scopeType,
      createForm.scopeId,
      activeClubId
    );
    const tenantId = resolvedTenantId;
    if (!tenantId) {
      setError(PRIVATE_PAIRING_PICKER_MESSAGES.NO_CLUB_MESSAGE);
      return;
    }
    if (
      SCOPES_REQUIRING_ID.includes(createForm.scopeType) &&
      createForm.scopeType === PRIVATE_PAIRING_SCOPE.CLUB &&
      !scopeId
    ) {
      setError("CLUB scope yêu cầu club_id (không dùng tenant_id).");
      return;
    }
    const result = await createPrivatePairingRuleSet({
      name: createForm.name,
      description: createForm.description || null,
      scopeType: createForm.scopeType,
      scopeId,
      tenantId,
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

  const handleConflictCheck = () => {
    const result = detectPrivatePairingConflicts(rules.filter((r) => r.active !== false), {
      teamSize: 2,
      competitionClass: null,
      allowedByPublishedRules: false,
    });
    setConflictResult(result);
  };

  const versionHistoryRows = useMemo(() => {
    const meta = selectedRuleSetMeta;
    if (!meta) return [];
    const scopeType = meta.scope_type || meta.scopeType;
    const scopeId = meta.scope_id ?? meta.scopeId ?? "";
    return ruleSets.filter(
      (item) =>
        String(item.scope_type || item.scopeType) === String(scopeType) &&
        String(item.scope_id ?? item.scopeId ?? "") === String(scopeId)
    );
  }, [ruleSets, selectedRuleSetMeta]);

  if (!featureOn) {
    return (
      <Alert severity="warning">
        Feature flag <code>VITE_PRIVATE_PAIRING_RULES_ENABLED</code> đang tắt. Menu và route admin bị
        ẩn/không khả dụng.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <AdminPanelSettingsIcon color="warning" />
        <Typography variant="h5" fontWeight={700}>
          Quy tắc ghép cặp riêng
        </Typography>
        <Chip size="small" color="warning" label="Chỉ SUPER_ADMIN" />
        <Chip
          size="small"
          variant="outlined"
          label={featureOn ? "Flag ON" : "Flag OFF"}
          color={featureOn ? "success" : "default"}
        />
        <Chip
          size="small"
          variant="outlined"
          label={simulationFlagOn ? "Sim ON" : "Sim OFF"}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Thiết lập điều kiện ưu tiên và ràng buộc cho AI ghép cặp. Không dùng để dàn xếp kết quả.
        Actor: {user?.email || user?.id || "—"}.
      </Typography>

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
          <Button startIcon={<RefreshIcon />} onClick={refreshList} disabled={loading} aria-label="Làm mới">
            Làm mới
          </Button>
          {canManage && (
            <Button variant="contained" onClick={() => setCreateOpen(true)} aria-label="Tạo bộ quy tắc">
              Tạo bộ quy tắc
            </Button>
          )}
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 280, maxHeight: 560, overflow: "auto", p: 1 }}>
          <PrivatePairingRuleSetList
            ruleSets={filteredRuleSets}
            selectedId={selectedRuleSetId}
            loading={loading}
            canManage={canManage}
            onSelect={setSelectedRuleSetId}
            onOpenCreate={() => setCreateOpen(true)}
            onClone={async (id) => {
              setSelectedRuleSetId(id);
              const result = await clonePrivatePairingRuleSetVersion({
                sourceRuleSetId: id,
                reason: actionReason || "clone-version",
              });
              if (!result.ok) {
                setError(errMsg(result));
                return;
              }
              setMessage("Đã clone version (draft mới).");
              await refreshList();
              const newId = result.rule_set?.id || result.ruleSet?.id;
              if (newId) setSelectedRuleSetId(newId);
            }}
            onSimulateTab={() => setTab(2)}
          />
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
                {canManage && <Button onClick={handleClone}>Clone Version</Button>}
                {canManage && (
                <Button
                  variant="contained"
                  color="success"
                  disabled={!isDraft || (conflictResult?.fatalConflicts || []).length > 0}
                  onClick={handleActivate}
                  aria-label="Kích hoạt bộ quy tắc"
                >
                  Kích hoạt bộ quy tắc
                </Button>
                )}
                {canManage && (
                  <Button color="warning" onClick={handleRollback}>
                    Rollback Version
                  </Button>
                )}
              </Stack>

              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
                <Tab label="Rules" />
                <Tab label="Xung đột / Version" />
                <Tab label="Mô phỏng" />
                <Tab label="Audit Logs" disabled={!canAudit} />
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
                    {canManage && (
                      <Button
                        variant="contained"
                        disabled={!isDraft}
                        onClick={openCreateRule}
                        aria-label="Thêm Rule"
                      >
                        Thêm Rule
                      </Button>
                    )}
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
                <Stack spacing={2}>
                  <PrivatePairingConflictPanel
                    result={conflictResult}
                    onCheck={handleConflictCheck}
                    canActivate={canManage && isDraft}
                    onActivate={handleActivate}
                  />
                  <PrivatePairingVersionHistory
                    versions={versionHistoryRows}
                    selectedId={selectedRuleSetId}
                    canManage={canManage}
                    isActiveReadOnly={!isDraft}
                    onSelect={setSelectedRuleSetId}
                    onClone={(id) => {
                      setSelectedRuleSetId(id);
                      void handleClone();
                    }}
                    onRollback={(id) => {
                      setSelectedRuleSetId(id);
                      void handleRollback();
                    }}
                  />
                </Stack>
              )}

              {tab === 2 && (
                <PrivatePairingSimulationPanel
                  enabled={simulationFlagOn}
                  canSimulate={canSimulate}
                  rules={rules}
                  playerOptions={playerOptions}
                  mappingSummary={pickerMappingSummary}
                  pickerWarnings={pickerWarnings}
                  sourceClubId={effectivePlayerClubId || ""}
                  scopeType={selectedRuleSetScope}
                  scopeId={selectedRuleSetMeta?.scope_id || selectedRuleSetMeta?.scopeId}
                  tenantId={resolvedTenantId}
                />
              )}

              {tab === 3 && <PrivatePairingAuditLog logs={auditLogs} canView={canAudit} />}
            </>
          )}
        </Paper>
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tạo Rule Set</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
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
                onChange={(e) => setCreateForm((f) => ({ ...f, scopeType: e.target.value }))}
              >
                {SCOPE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {SCOPE_LABELS[s] || s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Scope ID"
              helperText={
                SCOPES_REQUIRING_ID.includes(createForm.scopeType)
                  ? `Bắt buộc — mặc định gợi ý CLB: ${activeClubId || "—"}`
                  : "Tùy scope"
              }
              value={createForm.scopeId}
              onChange={(e) => setCreateForm((f) => ({ ...f, scopeId: e.target.value }))}
              fullWidth
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
          <Button variant="contained" onClick={handleCreateRuleSet} disabled={!createForm.name}>
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
                <strong>{clubNameById.get(String(activeClubId)) || activeClubId || "—"}</strong>.
                Đổi CLB ở header/context nếu cần.
              </Alert>
            )}

            {playerSelectorEmptyMessage && (
              <Alert severity="warning">{playerSelectorEmptyMessage}</Alert>
            )}

            {pickerMappingSummary && (
              <Alert severity={pickerWarnings.length ? "warning" : "info"}>
                Thành viên active: {pickerMappingSummary.activeMembers ?? "—"} · đã map:{" "}
                {pickerMappingSummary.mappedPlayers ?? 0} · derived:{" "}
                {pickerMappingSummary.derivedPlayers ?? 0} · chưa map:{" "}
                {pickerMappingSummary.unmappedMembers ?? 0}
                {pickerWarnings.length
                  ? ` · warnings: ${pickerWarnings.length}`
                  : ""}
              </Alert>
            )}

            <Autocomplete
              options={playerOptions}
              getOptionLabel={(o) => o.label || `${o.name} (${o.id})`}
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
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="VĐV chính (primary)"
                  required
                  helperText="Chỉ chọn từ danh sách — lưu player_id."
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
                {CONSTRAINT_TYPE_GROUPS.map((group) => [
                  <MenuItem key={`g-${group.id}`} disabled dense>
                    — {group.label} —
                  </MenuItem>,
                  ...group.types.map((t) => (
                    <MenuItem key={t} value={t}>
                      {CONSTRAINT_TYPE_LABELS[t] || t}
                    </MenuItem>
                  )),
                ])}
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={targetPlayerOptions}
              getOptionLabel={(o) => o.label || `${o.name} (${o.id})`}
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
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Target players"
                  required
                  helperText="Loại trừ VĐV chính; lưu player_id."
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
                required={ruleDraft.severity === "soft"}
                value={ruleDraft.weight}
                onChange={(e) => setRuleDraft((d) => ({ ...d, weight: e.target.value }))}
                inputProps={{ min: 1, max: 100, "aria-label": "Weight soft 1-100" }}
                helperText={ruleDraft.severity === "hard" ? "Hard không dùng weight" : "1–100"}
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
                      {m === "ANY_OF"
                        ? "ANY_OF — ít nhất một VĐV"
                        : m === "ALL_OF"
                          ? "ALL_OF — toàn bộ VĐV"
                          : m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            {ruleDraft.severity === "hard" ? (
              <Alert severity="warning">
                Hard — Vi phạm quy tắc này sẽ làm phương án bị loại.
              </Alert>
            ) : (
              <Alert severity="info">
                Soft — AI sẽ ưu tiên nhưng có thể không đáp ứng nếu có phương án công bằng hơn.
              </Alert>
            )}
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
              form này rồi lưu qua RPC update/create.
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
        <Alert severity="error" sx={{ m: 2 }} data-testid="private-pairing-forbidden">
          403_FORBIDDEN — Chỉ SUPER_ADMIN mới được xem và quản lý Quy tắc ghép cặp riêng.
        </Alert>
      }
    >
      <PrivatePairingRulesAdminInner />
    </SuperAdminFeatureGate>
  );
}
