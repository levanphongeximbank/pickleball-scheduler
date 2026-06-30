import {
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";

export default function ExportStatsPanel({
  rounds,
  selectedRound,
  onSelectedRoundChange,
  shiftOptions,
  selectedShift,
  onSelectedShiftChange,
  filteredSessions,
  onExportFilteredCsv,
}) {
  return (
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Bộ lọc thống kê
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Round</InputLabel>
              <Select
                label="Round"
                value={selectedRound}
                onChange={(event) => onSelectedRoundChange(event.target.value)}
              >
                <MenuItem value="all">Tất cả round</MenuItem>
                {rounds.map((round) => (
                  <MenuItem key={round.id} value={String(round.id)}>
                    {round.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Ca chơi</InputLabel>
              <Select
                label="Ca chơi"
                value={selectedShift}
                onChange={(event) => onSelectedShiftChange(event.target.value)}
              >
                <MenuItem value="all">Tất cả ca</MenuItem>
                {shiftOptions.map((shift) => (
                  <MenuItem key={shift} value={shift}>
                    {shift}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Chip label={`Sessions sau lọc: ${filteredSessions.length}`} color="info" />
            <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
              <Button variant="outlined" onClick={onExportFilteredCsv}>
                Xuất CSV theo bộ lọc
              </Button>
            </PermissionGate>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
