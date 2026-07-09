import { Button, Stack, Tooltip } from "@mui/material";

export default function MyClubActionBar({
  activeView,
  onViewChange,
  hasClub,
  onJoinClick,
  onLeaveClick,
  leaveLoading = false,
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
      <Button
        variant={activeView === "discover" ? "contained" : "outlined"}
        onClick={() => onViewChange("discover")}
      >
        Danh sách câu lạc bộ
      </Button>

      {hasClub && (
        <Button
          variant={activeView === "schedule" ? "contained" : "outlined"}
          onClick={() => onViewChange("schedule")}
        >
          Lịch sinh hoạt
        </Button>
      )}

      <Tooltip title={hasClub ? "Bạn đã thuộc một CLB" : ""}>
        <span>
          <Button variant="outlined" onClick={onJoinClick} disabled={hasClub}>
            Xin gia nhập CLB
          </Button>
        </span>
      </Tooltip>

      {hasClub && (
        <Button
          variant="outlined"
          color="warning"
          onClick={onLeaveClick}
          disabled={leaveLoading}
        >
          Rời câu lạc bộ
        </Button>
      )}
    </Stack>
  );
}
