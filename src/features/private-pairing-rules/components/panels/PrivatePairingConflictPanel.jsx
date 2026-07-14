import {
  Alert,
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

/**
 * Displays conflict detector results (codes for tests; labels for humans).
 */
export default function PrivatePairingConflictPanel({
  result,
  loading = false,
  onCheck,
  canActivate = false,
  onActivate,
}) {
  const fatal = result?.fatalConflicts || [];
  const warnings = result?.warnings || [];
  const checked = Boolean(result);
  const blocked = fatal.length > 0;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <Typography variant="subtitle1" fontWeight={600}>
          Kiểm tra xung đột
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={onCheck}
          disabled={loading || typeof onCheck !== "function"}
          aria-label="Kiểm tra xung đột"
        >
          Kiểm tra xung đột
        </Button>
        {checked && (
          <Chip
            size="small"
            color={blocked ? "error" : warnings.length ? "warning" : "success"}
            label={blocked ? "FATAL" : warnings.length ? "WARNING" : "OK"}
          />
        )}
      </Stack>

      {blocked && (
        <Alert severity="error" sx={{ mb: 1 }}>
          Có fatal conflict — không được kích hoạt bộ quy tắc.
        </Alert>
      )}

      {(fatal.length > 0 || warnings.length > 0) && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Severity</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Rules</TableCell>
              <TableCell>Players</TableCell>
              <TableCell>Suggestion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...fatal, ...warnings].map((item, index) => (
              <TableRow key={`${item.code}-${index}`}>
                <TableCell>{item.severity}</TableCell>
                <TableCell>
                  <code>{item.code}</code>
                </TableCell>
                <TableCell>{(item.ruleIds || []).join(", ")}</TableCell>
                <TableCell>{(item.playerIds || []).join(", ")}</TableCell>
                <TableCell>{item.suggestedResolution || item.messageKey || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {checked && !blocked && fatal.length === 0 && warnings.length === 0 && (
        <Alert severity="success">Không phát hiện xung đột fatal/warning.</Alert>
      )}

      {canActivate && typeof onActivate === "function" && (
        <Button
          sx={{ mt: 1 }}
          variant="contained"
          color="success"
          disabled={blocked}
          onClick={onActivate}
          aria-label="Kích hoạt bộ quy tắc"
        >
          Kích hoạt bộ quy tắc
        </Button>
      )}
    </Box>
  );
}
