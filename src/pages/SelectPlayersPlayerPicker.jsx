import { collectIds, toggleSelectionByChecked } from "./selectPlayers.selection.logic";

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

export default function SelectPlayersPlayerPicker({
  filteredPlayers,
  players,
  selectedPlayers,
  onSelectedPlayersChange,
  lockedPlayers,
  onTogglePlayerLock,
}) {
  return (
    <>
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 3, alignItems: "center" }}
      >
        <Button
          variant="contained"
          onClick={() => onSelectedPlayersChange(collectIds(filteredPlayers))}
        >
          Chọn tất cả
        </Button>

        <Button
          color="error"
          variant="outlined"
          onClick={() => onSelectedPlayersChange([])}
        >
          Bỏ chọn tất cả
        </Button>

        <Typography fontWeight="bold">
          Đã chọn: {selectedPlayers.length} / {players.length} người
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {filteredPlayers.map((player) => (
          <Grid
            key={player.id}
            size={{
              xs: 12,
              sm: 6,
              md: 4,
            }}
          >
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Checkbox
                    checked={selectedPlayers.includes(player.id)}
                    onChange={(e) => {
                      onSelectedPlayersChange(
                        toggleSelectionByChecked(
                          selectedPlayers,
                          player.id,
                          e.target.checked
                        )
                      );
                    }}
                  />

                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {player.name}
                    </Typography>

                    <Typography>🏓 Level: {player.level}</Typography>

                    {lockedPlayers.includes(player.id) && (
                      <Typography variant="body2" color="error.main" fontWeight="bold">
                        Director đang khóa người này
                      </Typography>
                    )}
                  </Box>

                  <Button
                    size="small"
                    variant={lockedPlayers.includes(player.id) ? "contained" : "outlined"}
                    color={lockedPlayers.includes(player.id) ? "warning" : "primary"}
                    onClick={() => onTogglePlayerLock(player.id)}
                  >
                    {lockedPlayers.includes(player.id) ? "Mở khóa" : "Khóa"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
