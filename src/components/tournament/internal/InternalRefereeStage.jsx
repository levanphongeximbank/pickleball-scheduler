import { useState } from "react";

import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import RefereeRosterPanel from "../RefereeRosterPanel.jsx";
import InternalMatchRefereeSelect from "./InternalMatchRefereeSelect.jsx";
import { getRefereeSettings } from "../../../tournament/engines/refereeEngine.js";
import {
  INTERNAL_NO_REFEREE_ROSTER_MESSAGE,
  formatInternalMatchRefereeLabel,
  listEligibleInternalReferees,
  listInternalMatchesForRefereeBoard,
  summarizeInternalRefereeCoverage,
} from "../../../features/tournament/internal/internalMatchRefereeAssignment.js";

export default function InternalRefereeStage({
  tournament,
  event,
  entryLabels = {},
  pendingMatchId = null,
  onRosterChange,
  onAssign,
  canonicalCandidates = [],
  canonicalLoading = false,
  canonicalError = null,
  canonicalWarning = null,
  enableCanonicalDirectory = false,
}) {
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const roster = listEligibleInternalReferees(tournament);
  const coverage = summarizeInternalRefereeCoverage(event);
  const matches = listInternalMatchesForRefereeBoard(event, { unassignedOnly });
  const hasMatches = (event?.matches || []).length > 0;

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="h6">Trọng tài</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Tổng số trận: ${coverage.total}`} />
        <Chip size="small" color="success" variant="outlined" label={`Đã phân công: ${coverage.assigned}`} />
        <Chip
          size="small"
          color={coverage.unassigned ? "warning" : "default"}
          variant="outlined"
          label={`Chưa phân công: ${coverage.unassigned}`}
        />
      </Stack>

      {coverage.unassigned > 0 ? (
        <Alert severity="info">
          Còn {coverage.unassigned} trận chưa có trọng tài. Phân công bên dưới hoặc thêm trọng tài vào danh sách.
        </Alert>
      ) : null}

      <RefereeRosterPanel
        roster={getRefereeSettings(tournament).roster}
        onChange={onRosterChange}
        title="Danh sách trọng tài của giải"
        description="Chọn tài khoản trọng tài của CLB để trọng tài đăng nhập thấy trận được phân công. Có thể thêm trọng tài khách nếu chưa có tài khoản."
        enableCanonicalDirectory={enableCanonicalDirectory}
        canonicalCandidates={canonicalCandidates}
        canonicalLoading={canonicalLoading}
        canonicalError={canonicalError}
        canonicalWarning={canonicalWarning}
      />

      {!roster.length ? (
        <Alert severity="warning">{INTERNAL_NO_REFEREE_ROSTER_MESSAGE}</Alert>
      ) : null}

      {!hasMatches ? (
        <Alert severity="info">
          Chưa có trận để phân công. Tạo lịch thi đấu trước, rồi quay lại đây để gán trọng tài.
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              Phân công theo trận
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={unassignedOnly}
                  onChange={(eventChange) => setUnassignedOnly(eventChange.target.checked)}
                />
              }
              label="Chưa phân công"
            />
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Trận</TableCell>
                <TableCell>Vòng</TableCell>
                <TableCell>Đội/VĐV A</TableCell>
                <TableCell>Đội/VĐV B</TableCell>
                <TableCell>Trọng tài</TableCell>
                <TableCell>Phân công</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>{match.id}</TableCell>
                  <TableCell>
                    {match.bracketMatchId ? "Knock-out" : "Vòng bảng"}
                  </TableCell>
                  <TableCell>{entryLabels[match.entryAId] || match.entryAId || "—"}</TableCell>
                  <TableCell>{entryLabels[match.entryBId] || match.entryBId || "—"}</TableCell>
                  <TableCell>{formatInternalMatchRefereeLabel(match)}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>
                    <InternalMatchRefereeSelect
                      match={match}
                      roster={roster}
                      pending={String(pendingMatchId || "") === String(match.id)}
                      onAssign={onAssign}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {unassignedOnly && matches.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Đã phân công hết trận.
            </Typography>
          ) : null}
          {coverage.unassigned > 0 ? (
            <Button sx={{ mt: 1.5 }} variant="outlined" onClick={() => setUnassignedOnly(true)}>
              Chỉ hiện trận chưa phân công
            </Button>
          ) : null}
        </Paper>
      )}
    </Stack>
  );
}
