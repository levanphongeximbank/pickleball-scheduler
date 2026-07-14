import {
  Alert,
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

/**
 * Version history for logical rule-set scope.
 */
export default function PrivatePairingVersionHistory({
  versions = [],
  selectedId = "",
  canManage = false,
  onSelect,
  onClone,
  onRollback,
  isActiveReadOnly = false,
}) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Lịch sử version
      </Typography>
      {isActiveReadOnly && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Active version chỉ xem. Clone để tạo Draft mới.
        </Alert>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Version</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {versions.map((item) => (
            <TableRow key={item.id} selected={String(item.id) === String(selectedId)}>
              <TableCell>{item.version ?? item.version_number ?? "—"}</TableCell>
              <TableCell>{item.status}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.updated_at || item.updatedAt || "—"}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => onSelect?.(item.id)}>
                    Xem
                  </Button>
                  {canManage && (
                    <Button size="small" onClick={() => onClone?.(item.id)}>
                      Clone
                    </Button>
                  )}
                  {canManage && String(item.status) !== "draft" && (
                    <Button size="small" onClick={() => onRollback?.(item.id)}>
                      Rollback
                    </Button>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
          {!versions.length && (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography variant="body2" color="text.secondary">
                  Chưa có lịch sử version trong scope này.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
