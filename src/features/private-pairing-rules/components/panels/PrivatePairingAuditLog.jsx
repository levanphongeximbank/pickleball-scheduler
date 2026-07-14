import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMemo, useState } from "react";

const ACTION_FILTERS = [
  "",
  "CREATE_RULE_SET",
  "ACTIVATE_RULE_SET",
  "ARCHIVE_RULE_SET",
  "ROLLBACK_RULE_SET",
  "CREATE_PRIVATE_PAIRING_RULE",
  "UPDATE_PRIVATE_PAIRING_RULE",
  "DISABLE_PRIVATE_PAIRING_RULE",
  "DELETE_PRIVATE_PAIRING_RULE",
  "ADD_RULE_TARGET",
  "REMOVE_RULE_TARGET",
  "SIMULATE_PRIVATE_PAIRING",
];

function summarizePayload(value) {
  if (value == null) return "—";
  if (typeof value === "string") return value.slice(0, 160);
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return "—";
  }
}

export default function PrivatePairingAuditLog({ logs = [], canView = true }) {
  const [actionFilter, setActionFilter] = useState("");

  const filtered = useMemo(() => {
    if (!actionFilter) return logs || [];
    return (logs || []).filter(
      (log) => String(log.action || "").toUpperCase() === actionFilter
    );
  }, [logs, actionFilter]);

  if (!canView) {
    return (
      <Typography variant="body2" color="text.secondary">
        Thiếu quyền pairing.private_rules.audit.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Action</InputLabel>
          <Select
            label="Action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            inputProps={{ "aria-label": "Lọc audit action" }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {ACTION_FILTERS.filter(Boolean).map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Thời gian</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Actor</TableCell>
            <TableCell>Rule set / Rule</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Diff</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((log, idx) => (
            <TableRow key={log.id || idx}>
              <TableCell>{log.created_at || log.createdAt || "—"}</TableCell>
              <TableCell>
                <code>{log.action}</code>
              </TableCell>
              <TableCell>{log.actor_user_id || log.actorUserId || "—"}</TableCell>
              <TableCell>
                {(log.rule_set_id || log.ruleSetId || "—") +
                  " / " +
                  (log.rule_id || log.ruleId || "—")}
              </TableCell>
              <TableCell>{log.reason || "—"}</TableCell>
              <TableCell>
                <Accordion disableGutters elevation={0}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="caption">before/after</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="caption" component="pre" sx={{ whiteSpace: "pre-wrap" }}>
                      before: {summarizePayload(log.before_data || log.beforeData)}
                      {"\n"}
                      after: {summarizePayload(log.after_data || log.afterData)}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </TableCell>
            </TableRow>
          ))}
          {!filtered.length && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography variant="body2" color="text.secondary">
                  Chưa có audit log.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
