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
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 2 },
        mb: 2.5,
        borderRadius: 2,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        bgcolor: "#ffffff",
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
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
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

        <Box sx={{ width: { xs: "100%", lg: 180 }, px: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Level {levelRange[0].toFixed(1)}–{levelRange[1].toFixed(1)}
          </Typography>
          <Slider
            value={levelRange}
            min={1.5}
            max={6}
            step={0.1}
            size="small"
            onChange={(_, value) => onLevelRangeChange(value)}
            valueLabelDisplay="auto"
          />
        </Box>

        <Button
          variant="text"
          size="small"
          startIcon={<FilterAltOffIcon />}
          onClick={onClearFilters}
          sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          Xóa bộ lọc
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        <strong>{filteredCount}</strong>/{totalCount} người chơi đang hiển thị
      </Typography>
    </Paper>
  );
}
