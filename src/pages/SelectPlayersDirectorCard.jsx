import { useState } from "react";

import {
  addPolicy,
  addRule,
  removePolicy,
  removeRule,
  togglePolicy,
  toggleRule,
} from "../ai/policy";
import {
  countEnabledItems,
  getPolicyTooltip,
  getRuleLabel,
  getRuleTooltip,
} from "./selectPlayers.director.logic";
import {
  DIRECTOR_POLICY_TYPES,
  DIRECTOR_RULE_TYPES,
  buildDefaultPolicy,
  buildDefaultRule,
  formatPolicyLabel,
  validatePolicyDraft,
} from "./selectPlayers.director.manager.logic";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

export default function SelectPlayersDirectorCard({
  lockedCourts,
  lockedPlayers,
  clubPolicies,
  clubRules,
  players = [],
  onDirectorConfigChange,
}) {
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [ruleType, setRuleType] = useState(DIRECTOR_RULE_TYPES[0].id);
  const [policyType, setPolicyType] = useState(DIRECTOR_POLICY_TYPES[0].id);
  const [policyPlayerA, setPolicyPlayerA] = useState("");
  const [policyPlayerB, setPolicyPlayerB] = useState("");
  const [formError, setFormError] = useState(null);

  const refreshDirectorConfig = () => {
    onDirectorConfigChange?.();
  };

  const handleAddRule = () => {
    addRule(buildDefaultRule(ruleType));
    setRuleDialogOpen(false);
    refreshDirectorConfig();
  };

  const handleAddPolicy = () => {
    const error = validatePolicyDraft({
      type: policyType,
      playerA: policyPlayerA,
      playerB: policyPlayerB,
    });

    if (error) {
      setFormError(error);
      return;
    }

    addPolicy(buildDefaultPolicy(policyType, policyPlayerA, policyPlayerB));
    setFormError(null);
    setPolicyPlayerA("");
    setPolicyPlayerB("");
    setPolicyDialogOpen(false);
    refreshDirectorConfig();
  };

  const handleToggleRule = (ruleId) => {
    toggleRule(ruleId);
    refreshDirectorConfig();
  };

  const handleRemoveRule = (ruleId) => {
    removeRule(ruleId);
    refreshDirectorConfig();
  };

  const handleTogglePolicy = (policyId) => {
    togglePolicy(policyId);
    refreshDirectorConfig();
  };

  const handleRemovePolicy = (policyId) => {
    removePolicy(policyId);
    refreshDirectorConfig();
  };

  return (
    <Card sx={{ mb: 2, border: "1px solid", borderColor: "primary.light", bgcolor: "primary.50" }}>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Director Mode
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Khóa sân/người, quản lý rule và policy trước khi bấm xếp.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Chip label={`Sân khóa: ${lockedCourts.length}`} color="warning" />
            <Chip label={`Người khóa: ${lockedPlayers.length}`} color="error" />
            <Chip label={`Policy: ${countEnabledItems(clubPolicies)}`} color="info" />
            <Chip label={`Rule: ${countEnabledItems(clubRules)}`} color="success" />
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setRuleDialogOpen(true)}>
            Thêm rule
          </Button>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setPolicyDialogOpen(true)}>
            Thêm policy
          </Button>
        </Stack>

        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          Rules của CLB
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
          {clubRules.length === 0 && (
            <Chip label="Chưa có rule tùy chỉnh" variant="outlined" />
          )}
          {clubRules.map((rule) => (
            <Stack key={rule.id} direction="row" spacing={0.5} alignItems="center">
              <Tooltip title={`${getRuleTooltip(rule)} Bấm để bật/tắt.`} placement="top">
                <Chip
                  label={getRuleLabel(rule)}
                  color={rule.enabled === false ? "default" : "success"}
                  variant={rule.enabled === false ? "outlined" : "filled"}
                  onClick={() => handleToggleRule(rule.id)}
                />
              </Tooltip>
              <IconButton size="small" aria-label="Xóa rule" onClick={() => handleRemoveRule(rule.id)}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>

        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          Policies đang áp dụng
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {clubPolicies.length === 0 && (
            <Chip label="Chưa có policy" variant="outlined" />
          )}
          {clubPolicies.map((policy) => (
            <Stack key={policy.id} direction="row" spacing={0.5} alignItems="center">
              <Tooltip title={`${getPolicyTooltip(policy)} Bấm để bật/tắt.`} placement="top">
                <Chip
                  label={formatPolicyLabel(policy, players)}
                  color={policy.enabled === false ? "default" : "info"}
                  variant={policy.enabled === false ? "outlined" : "filled"}
                  onClick={() => handleTogglePolicy(policy.id)}
                />
              </Tooltip>
              <IconButton size="small" aria-label="Xóa policy" onClick={() => handleRemovePolicy(policy.id)}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </CardContent>

      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Thêm rule CLB</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Loại rule</InputLabel>
            <Select
              label="Loại rule"
              value={ruleType}
              onChange={(event) => setRuleType(event.target.value)}
            >
              {DIRECTOR_RULE_TYPES.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleAddRule}>
            Thêm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={policyDialogOpen} onClose={() => setPolicyDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Thêm policy Director</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Loại policy</InputLabel>
              <Select
                label="Loại policy"
                value={policyType}
                onChange={(event) => setPolicyType(event.target.value)}
              >
                {DIRECTOR_POLICY_TYPES.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Người A</InputLabel>
              <Select
                label="Người A"
                value={policyPlayerA}
                onChange={(event) => setPolicyPlayerA(event.target.value)}
              >
                {players.map((player) => (
                  <MenuItem key={player.id} value={player.id}>
                    {player.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Người B</InputLabel>
              <Select
                label="Người B"
                value={policyPlayerB}
                onChange={(event) => setPolicyPlayerB(event.target.value)}
              >
                {players.map((player) => (
                  <MenuItem key={player.id} value={player.id}>
                    {player.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {formError && (
              <TextField error helperText={formError} disabled value=" " />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleAddPolicy}>
            Thêm
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
