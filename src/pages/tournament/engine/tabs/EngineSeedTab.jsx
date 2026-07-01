import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

export default function EngineSeedTab({ engine }) {
  const { engineState, generateSeed, context } = engine;
  const participants = engineState.seedResult?.participants || engineState.participants || [];

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Button
          variant="contained"
          startIcon={<AutoFixHighIcon />}
          onClick={generateSeed}
        >
          Tạo hạt giống
        </Button>
        <Chip label={`VĐV: ${context?.participants?.length || 0}`} size="small" variant="outlined" />
        <Chip label={`Seed: ${participants.length}`} size="small" variant="outlined" />
      </Stack>

      {participants.length === 0 ? (
        <Alert severity="info">Chưa có hạt giống. Nhấn &quot;Tạo hạt giống&quot; để bắt đầu.</Alert>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Seed</TableCell>
                <TableCell>Tên</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell>Lý do AI</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.seed ?? "—"}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{row.seedScore ?? "—"}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{row.seedReason || "—"}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {context?.participants?.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Giải chưa có VĐV. Thêm người chơi hoặc đăng ký đội trước khi seed.
        </Alert>
      )}
    </Box>
  );
}
