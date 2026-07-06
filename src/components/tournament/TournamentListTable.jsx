import { useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SportsIcon from "@mui/icons-material/Sports";

import { TOURNAMENT_MODE } from "../../models/tournament/index.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import TournamentActionBar from "./TournamentActionBar.jsx";
import TournamentEmptyState from "./TournamentEmptyState.jsx";
import TournamentSectionCard from "./TournamentSectionCard.jsx";
import { TournamentModeChip, TournamentStatusChip } from "./TournamentStatusChip.jsx";
import {
  TOURNAMENT_LAYOUT,
  tournamentTableCellSx,
  tournamentTableHeadSx,
} from "./tournamentLayout.js";

function resolveTournamentPath(tournament) {
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return `/tournament/official/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    return `/tournament/team/${tournament.id}`;
  }
  return null;
}

function isNavigable(tournament) {
  return Boolean(resolveTournamentPath(tournament));
}

export default function TournamentListTable({
  tournaments = [],
  selectedIds = [],
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  canDeleteTournament,
  showCaptainPortal,
  onCaptainPortal,
}) {
  const navigate = useNavigate();
  const allSelected =
    tournaments.length > 0 && selectedIds.length === tournaments.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleRowClick = (tournament) => {
    const path = resolveTournamentPath(tournament);
    if (path) navigate(path);
  };

  if (tournaments.length === 0) {
    return (
      <TournamentSectionCard title="Danh sách giải" badge={<Chip size="small" label="0 giải" variant="outlined" />}>
        <TournamentEmptyState
          title="Chưa có giải"
          description="Chọn loại giải ở trên để tạo giải nháp."
        />
      </TournamentSectionCard>
    );
  }

  return (
    <TournamentSectionCard
      title="Danh sách giải"
      badge={<Chip size="small" label={`${tournaments.length} giải`} variant="outlined" />}
      noPadding
      contentSx={{ pt: 1.5 }}
    >
      <Box sx={{ px: TOURNAMENT_LAYOUT.cardPadding, pb: 0.5 }}>
        <TournamentActionBar summary={`Đã chọn: ${selectedIds.length} / ${tournaments.length} giải`}>
          <Button variant="contained" size="small" onClick={onSelectAll}>
            Chọn tất cả
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={onClearSelection}
            disabled={selectedIds.length === 0}
          >
            Bỏ chọn tất cả
          </Button>
          <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
            <Button
              color="error"
              variant="outlined"
              size="small"
              disabled={selectedIds.length === 0}
              onClick={onDeleteSelected}
            >
              Xóa đã chọn ({selectedIds.length})
            </Button>
          </PermissionGate>
        </TournamentActionBar>
      </Box>

      <TableContainer sx={{ maxHeight: TOURNAMENT_LAYOUT.tableMaxHeight }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={tournamentTableHeadSx}>
                <Checkbox
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={(event) => {
                    if (event.target.checked) onSelectAll();
                    else onClearSelection();
                  }}
                />
              </TableCell>
              <TableCell sx={tournamentTableHeadSx}>Giải đấu</TableCell>
              <TableCell sx={{ ...tournamentTableHeadSx, display: { xs: "none", sm: "table-cell" } }}>
                Loại
              </TableCell>
              <TableCell sx={tournamentTableHeadSx}>Trạng thái</TableCell>
              <TableCell align="right" sx={tournamentTableHeadSx}>
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tournaments.map((tournament) => {
              const selected = selectedIds.includes(tournament.id);
              const navigable = isNavigable(tournament);
              const showEngine =
                tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT ||
                tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT;
              const showPortal =
                tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT &&
                showCaptainPortal?.(tournament);

              return (
                <TableRow
                  key={tournament.id}
                  hover={navigable}
                  selected={selected}
                  sx={{ cursor: navigable ? "pointer" : "default" }}
                  onClick={() => navigable && handleRowClick(tournament)}
                >
                  <TableCell padding="checkbox" sx={tournamentTableCellSx}>
                    <Checkbox
                      checked={selected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onToggleSelection(tournament.id, event.target.checked)
                      }
                    />
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    <Typography variant="body2" fontWeight={600}>
                      {tournament.name}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ mt: 0.5, display: { xs: "flex", sm: "none" } }}
                    >
                      <TournamentModeChip mode={tournament.mode} />
                    </Stack>
                    {!canDeleteTournament(tournament) ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label="Không thể xóa"
                        sx={{ mt: 0.5, height: 20, fontSize: 10 }}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell
                    sx={{ ...tournamentTableCellSx, display: { xs: "none", sm: "table-cell" } }}
                  >
                    <TournamentModeChip mode={tournament.mode} />
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    <TournamentStatusChip status={tournament.status} />
                  </TableCell>
                  <TableCell align="right" sx={tournamentTableCellSx} onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {showEngine ? (
                        <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                          <Tooltip title="Engine 4.0">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/tournaments/${tournament.id}/engine`)}
                            >
                              <AutoAwesomeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </PermissionGate>
                      ) : null}
                      {showPortal ? (
                        <Tooltip title="Portal đội trưởng">
                          <IconButton
                            size="small"
                            onClick={() => onCaptainPortal?.(tournament)}
                          >
                            <SportsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </TournamentSectionCard>
  );
}
