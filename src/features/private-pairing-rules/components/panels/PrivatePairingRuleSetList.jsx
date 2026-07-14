import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { SCOPE_LABELS, STATUS_CHIP_COLOR } from "../../ui/privatePairingAdminHelpers.js";

function statusChip(status) {
  const value = String(status || "draft");
  return <Chip size="small" label={value} color={STATUS_CHIP_COLOR[value] || "default"} />;
}

/**
 * Rule set list with status-aware actions.
 */
export default function PrivatePairingRuleSetList({
  ruleSets = [],
  selectedId = "",
  loading = false,
  canManage = false,
  onSelect,
  onOpenCreate,
  onClone,
  onSimulateTab,
}) {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
        <Typography variant="subtitle1" fontWeight={600}>
          Danh sách rule set
        </Typography>
        {canManage && (
          <Button size="small" variant="contained" onClick={onOpenCreate} aria-label="Tạo bộ quy tắc">
            Tạo bộ quy tắc
          </Button>
        )}
      </Stack>

      {loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Đang tải…
        </Typography>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Tên</TableCell>
            <TableCell>Scope</TableCell>
            <TableCell>Version</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ruleSets.map((rs) => {
            const id = rs.id;
            const status = String(rs.status || "draft");
            const selected = String(id) === String(selectedId);
            return (
              <TableRow
                key={id}
                selected={selected}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => onSelect?.(id)}
              >
                <TableCell>{rs.name || id}</TableCell>
                <TableCell>
                  {SCOPE_LABELS[rs.scope_type || rs.scopeType] || rs.scope_type || rs.scopeType}
                  {" · "}
                  {rs.scope_id || rs.scopeId || "—"}
                </TableCell>
                <TableCell>{rs.version ?? rs.version_number ?? "—"}</TableCell>
                <TableCell>{statusChip(status)}</TableCell>
                <TableCell>{rs.updated_at || rs.updatedAt || "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Button size="small" onClick={() => onSelect?.(id)} aria-label={`Mở ${rs.name || id}`}>
                      {status === "draft" ? "Mở" : "Xem"}
                    </Button>
                    {(status === "active" || status === "archived") && canManage && (
                      <Button size="small" onClick={() => onClone?.(id)} aria-label="Clone version mới">
                        Clone
                      </Button>
                    )}
                    {typeof onSimulateTab === "function" && (
                      <Button
                        size="small"
                        onClick={() => {
                          onSelect?.(id);
                          onSimulateTab();
                        }}
                        aria-label="Mô phỏng"
                      >
                        Mô phỏng
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
          {!ruleSets.length && !loading && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography variant="body2" color="text.secondary">
                  Chưa có rule set. Tạo draft mới để bắt đầu.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
