import {
  buildAutoCourtSelection,
  collectIds,
  toggleSelectionByChecked,
} from "./selectPlayers.selection.logic";

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Stack,
  Typography,
} from "@mui/material";

export default function SelectPlayersCourtSelector({
  courts,
  activeCourts,
  selectedCourts,
  onSelectedCourtsChange,
  selectedPlayersCount,
  selectedCourtCount,
  selectAllActiveCourtsCount,
  maxPlayers,
  requiredCourts,
  selectEnoughCourtsLabel,
  requiredCourtsMessage,
  overCapacityMessage,
  capacityStatusMessage,
  selectedCourtsWarningMessage,
  playersPerCourt = 4,
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography fontWeight="bold" sx={{ mb: 1 }}>
        🏟️ Chọn sân sử dụng
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: "wrap" }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onSelectedCourtsChange(collectIds(activeCourts))}
        >
          Chọn tất cả sân
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={() => onSelectedCourtsChange([])}
        >
          Bỏ chọn tất cả
        </Button>
        {selectedPlayersCount > 0 && selectedCourtCount < selectAllActiveCourtsCount && (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => {
              const nextSelection = buildAutoCourtSelection({
                selectedPlayersCount,
                maxPlayers,
                activeCourts,
                requiredCourts,
              });
              onSelectedCourtsChange(nextSelection);
            }}
          >
            {selectEnoughCourtsLabel}
          </Button>
        )}
        <Typography sx={{ alignSelf: "center" }}>
          Đã chọn: {selectedCourtCount} / {activeCourts.length} sân hoạt động
        </Typography>
      </Stack>
      <Card sx={{ mb: 2, bgcolor: "grey.50" }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Tóm tắt sân
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sức chứa hiện tại: {activeCourts.length} sân × {playersPerCourt} = {maxPlayers} người.
          </Typography>
          {requiredCourtsMessage && (
            <Typography variant="body2" color="text.secondary">
              {requiredCourtsMessage}
            </Typography>
          )}
          {overCapacityMessage && (
            <Typography variant="body2" color="error.main">
              {overCapacityMessage}
            </Typography>
          )}
        </CardContent>
      </Card>

      {activeCourts.length !== courts.length && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Một số sân đang tắt, chỉ những sân hoạt động mới có thể được chọn.
        </Typography>
      )}

      <Typography
        variant="body2"
        color={capacityStatusMessage.color}
        sx={{ mb: 1 }}
      >
        {capacityStatusMessage.text}
      </Typography>
      {requiredCourtsMessage && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {requiredCourtsMessage}
        </Typography>
      )}

      {selectedCourtsWarningMessage && (
        <Typography variant="body2" color="error.main" sx={{ mb: 2 }}>
          {selectedCourtsWarningMessage}
        </Typography>
      )}

      <Stack direction="column" spacing={1}>
        {courts.map((court) => (
          <Box key={court.id} sx={{ display: "flex", alignItems: "center" }}>
            <Checkbox
              checked={selectedCourts.includes(court.id)}
              disabled={court.active === false}
              onChange={(e) => {
                onSelectedCourtsChange(
                  toggleSelectionByChecked(selectedCourts, court.id, e.target.checked)
                );
              }}
            />

            <Typography sx={{ color: court.active === false ? "text.disabled" : "text.primary" }}>
              {court.name} {court.active === false ? "(không hoạt động)" : ""}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
