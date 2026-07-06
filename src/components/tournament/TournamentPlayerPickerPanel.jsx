import { useMemo } from "react";

import AddIcon from "@mui/icons-material/Add";
import {
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import {
  ALL_CLUBS_FILTER,
  filterTournamentPickerPlayers,
  formatPlayerPickerMeta,
} from "../../utils/tournamentPlayerPicker.js";

export default function TournamentPlayerPickerPanel({
  title = "Chọn VĐV",
  players = [],
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  clubFilter = ALL_CLUBS_FILTER,
  onClubFilterChange,
  clubs = [],
  genderFilter = "all",
  onGenderFilterChange,
  search = "",
  onSearchChange,
  eventType = null,
  excludePlayerIds = [],
  onAddNew,
  emptyMessage = "Không có VĐV phù hợp.",
  maxHeight = 320,
  mode = "select",
  onRegister,
  showClubFilter = true,
  showSelectActions = true,
  showPlayerList = true,
}) {
  const filteredPlayers = useMemo(
    () =>
      filterTournamentPickerPlayers(players, {
        clubFilter: showClubFilter ? clubFilter : ALL_CLUBS_FILTER,
        genderFilter,
        search,
        eventType,
        excludePlayerIds,
      }),
    [players, clubFilter, genderFilter, search, eventType, excludePlayerIds, showClubFilter]
  );

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll(filteredPlayers.map((player) => String(player.id)));
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" fontWeight="bold">
        {title}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        {showClubFilter && onClubFilterChange ? (
          <FormControl fullWidth size="small">
            <InputLabel id="picker-club-label">Câu lạc bộ</InputLabel>
            <Select
              labelId="picker-club-label"
              label="Câu lạc bộ"
              value={clubFilter}
              onChange={(event) => onClubFilterChange(event.target.value)}
            >
              <MenuItem value={ALL_CLUBS_FILTER}>Toàn bộ CLB</MenuItem>
              {clubs.map((club) => (
                <MenuItem key={club.id} value={club.id}>
                  {club.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {onGenderFilterChange ? (
          <FormControl fullWidth size="small">
            <InputLabel id="picker-gender-label">Giới tính</InputLabel>
            <Select
              labelId="picker-gender-label"
              label="Giới tính"
              value={genderFilter}
              onChange={(event) => onGenderFilterChange(event.target.value)}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="Nam">Nam</MenuItem>
              <MenuItem value="Nữ">Nữ</MenuItem>
            </Select>
          </FormControl>
        ) : null}
      </Stack>

      {onSearchChange ? (
        <TextField
          size="small"
          placeholder="Tìm tên VĐV..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {showSelectActions && mode === "select" ? (
          <>
            <Button
              size="small"
              variant="contained"
              onClick={handleSelectAll}
              disabled={filteredPlayers.length === 0}
            >
              Chọn tất cả
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onClearAll}
              disabled={selectedIds.length === 0}
            >
              Bỏ chọn tất cả
            </Button>
          </>
        ) : null}
        {onAddNew ? (
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAddNew}>
            Thêm VĐV mới
          </Button>
        ) : null}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {filteredPlayers.length}/{players.length} VĐV hiển thị
      </Typography>

      {showPlayerList ? (
      <Stack spacing={1} sx={{ maxHeight, overflow: "auto" }}>
        {filteredPlayers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          filteredPlayers.map((player) => {
            const playerId = String(player.id);
            const checked = selectedIds.includes(playerId);
            const handleClick = () => {
              if (mode === "register") {
                onRegister?.(player.id);
                return;
              }
              onToggle?.(player.id);
            };

            return (
              <Button
                key={player.id}
                fullWidth
                variant={mode === "select" && checked ? "contained" : "outlined"}
                onClick={handleClick}
                sx={{ justifyContent: "space-between", minHeight: 44, textAlign: "left" }}
              >
                <span>{player.name}</span>
                <span style={{ opacity: 0.85, marginLeft: 8, whiteSpace: "nowrap" }}>
                  {formatPlayerPickerMeta(player)}
                </span>
              </Button>
            );
          })
        )}
      </Stack>
      ) : null}
    </Stack>
  );
}
