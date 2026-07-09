import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";

import { SHELL } from "../../theme/designTokens.js";
import { TOURNAMENT_LAYOUT } from "../tournament/tournamentLayout.js";

export default function PlayerFilters({
  search,
  onSearchChange,
  genderFilter,
  onGenderFilterChange,
  levelRange,
  onLevelRangeChange,
  statusFilter,
  onStatusFilterChange,
  filteredCount,
  totalCount,
  onClearFilters,
  showLevelFilter = true,
}) {
  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 2 },
        mb: TOURNAMENT_LAYOUT.sectionGap,
        borderRadius: TOURNAMENT_LAYOUT.cardRadius,
        borderColor: SHELL.border,
        bgcolor: SHELL.cardBg,
        boxShadow: SHELL.cardShadow,
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", lg: "center" }}
      >
        <TextField
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm tên, SĐT, nickname..."
          size="small"
          sx={{ flex: 1, minWidth: { lg: 200 } }}
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

        <TextField
          select
          label="Giới tính"
          value={genderFilter}
          onChange={(e) => onGenderFilterChange(e.target.value)}
          size="small"
          sx={{ width: { xs: "100%", lg: 130 } }}
        >
          <MenuItem value="all">Tất cả</MenuItem>
          <MenuItem value="Nam">Nam</MenuItem>
          <MenuItem value="Nữ">Nữ</MenuItem>
        </TextField>

        <TextField
          select
          label="Trạng thái"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          size="small"
          sx={{ width: { xs: "100%", lg: 150 } }}
        >
          <MenuItem value="all">Tất cả</MenuItem>
          <MenuItem value="active">Đang hoạt động</MenuItem>
          <MenuItem value="checked_in">Đã check-in</MenuItem>
          <MenuItem value="rest">Nghỉ</MenuItem>
          <MenuItem value="locked">Bị khóa</MenuItem>
        </TextField>

        {showLevelFilter && (
          <Box sx={{ width: { xs: "100%", lg: 180 }, px: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Level {levelRange[0].toFixed(1)}–{levelRange[1].toFixed(1)}
            </Typography>
            <Slider
              value={levelRange}
              min={1.0}
              max={8.0}
              step={0.1}
              size="small"
              color="primary"
              onChange={(_, value) => onLevelRangeChange(value)}
              valueLabelDisplay="auto"
            />
          </Box>
        )}

        <Button
          variant="text"
          size="small"
          startIcon={<FilterAltOffIcon />}
          onClick={onClearFilters}
          sx={{ whiteSpace: "nowrap", flexShrink: 0, alignSelf: { lg: "center" } }}
        >
          Xóa bộ lọc
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
        <strong>{filteredCount}</strong>/{totalCount} người chơi đang hiển thị
      </Typography>
    </Paper>
  );
}
