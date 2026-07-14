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
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
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
  rollbackPrivatePairingRuleSet,
  runPrivatePairingRuntime,
  SCOPES_REQUIRING_ID,
  updatePrivatePairingRule,
} from "./privatePairingAdminApi.js";
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
} from "./privatePairingAdminHelpers.js";

function errMsg(result) {
  return result?.message || result?.code || "Thao tác thất bại";
}

function RuleSetStatusChip({ status }) {
  const value = String(status || "draft");
  return <Chip size="small" label={value} color={STATUS_CHIP_COLOR[value] || "default"} />;
}

function PrivatePairingRulesAdminInner() {
  const { user } = useAuth();
  const { activeClubId } = useClub();
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
  const [simulatorOut, setSimulatorOut] = useState(null);

  const featureOn = isPrivatePairingRulesEnabled();

  const players = useMemo(() => {
    try {
      return loadPlayersForClub(activeClubId) || [];
    } catch {
      return [];
    }
  }, [activeClubId]);

  const playersById = useMemo(
    () => new Map(players.map((p) => [String(p.id), p])),
    [players]
  );

  const playerOptions = useMemo(
    () => players.map((p) => ({ id: String(p.id), name: p.name || p.id })),
    [players]
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

  const rules = detail?.rules || [];
  const dbRules = detail?.dbRules || [];
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

  const selectedRuleSetMeta = detail?.ruleSet || detail?.rule_set || null;
  const isDraft = String(selectedRuleSetMeta?.status || "") === "draft";

  const openCreateRule = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyRuleDraft());
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
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedRuleSetId) return;
    const targets = (ruleDraft.targetPlayerIds || []).map(String).filter(Boolean);
    if (!String(ruleDraft.primaryPlayerId || "").trim()) {
      setError("Chọn VĐV chính.");
      return;
    }
    if (!targets.length) {
      setError("Chọn ít nhất một target player.");
      return;
    }
    if (ruleDraft.severity === "soft" && (ruleDraft.weight === "" || Number.isNaN(Number(ruleDraft.weight)))) {
      setError("Soft rule cần weight hợp lệ.");
      return;
    }
    setError(null);
    setMessage(null);
    const payloadBase = {
      primaryPlayerId: String(ruleDraft.primaryPlayerId || "").trim(),
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

  const handleCreateRuleSet = async () => {
    setError(null);
    const needsId = SCOPES_REQUIRING_ID.includes(createForm.scopeType);
    const scopeId = needsId
      ? createForm.scopeId || activeClubId || null
      : createForm.scopeId || null;
    const result = await createPrivatePairingRuleSet({
      name: createForm.name,
      description: createForm.description || null,
      scopeType: createForm.scopeType,
      scopeId,
      tenantId: currentTenantId || null,
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
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
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
            <Autocomplete
              options={playerOptions}
              getOptionLabel={(o) => (typeof o === "string" ? o : `${o.name} (${o.id})`)}
              value={
                playerOptions.find((p) => p.id === String(ruleDraft.primaryPlayerId)) ||
                (ruleDraft.primaryPlayerId
                  ? { id: ruleDraft.primaryPlayerId, name: ruleDraft.primaryPlayerId }
                  : null)
              }
              onChange={(_, v) =>
                setRuleDraft((d) => ({
                  ...d,
                  primaryPlayerId: v?.id || "",
                }))
              }
              freeSolo
              onInputChange={(_, value, reason) => {
                if (reason === "input") {
                  setRuleDraft((d) => ({ ...d, primaryPlayerId: value }));
                }
              }}
              renderInput={(params) => <TextField {...params} label="VĐV chính (primary)" />}
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
              options={playerOptions}
              getOptionLabel={(o) => `${o.name} (${o.id})`}
              value={playerOptions.filter((p) =>
                (ruleDraft.targetPlayerIds || []).includes(p.id)
              )}
              onChange={(_, v) =>
                setRuleDraft((d) => ({
                  ...d,
                  targetPlayerIds: v.map((x) => x.id),
                }))
              }
              renderInput={(params) => (
                <TextField {...params} label="Target players" helperText="Quản lý danh sách đích" />
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
              form này rồi lưu qua RPC update/create.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveRule}>
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
