import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ShuffleIcon from "@mui/icons-material/Shuffle";

import DrawPublishControls from "../../../../components/tournament/DrawPublishControls.jsx";
import { canRegenerateDraw, DRAW_PUBLISH_STATUS } from "../../../../tournament/engines/publishDrawEngine.js";

export default function EngineDrawTab({ engine }) {
  const {
    engineState,
    generateDraw,
    drawPublish,
    hasReopenPermission,
    lockDrawPublish,
    publishDrawResult,
    reopenDrawPublish,
    forceRedraw,
    tournament,
  } = engine;
  const draw = engineState.drawResult;
  const groups = draw?.groups || engineState.groups || [];
  const regenCheck = canRegenerateDraw(tournament);

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          startIcon={<ShuffleIcon />}
          onClick={generateDraw}
          disabled={!regenCheck.ok}
          title={regenCheck.ok ? "" : regenCheck.error}
        >
          Bốc thăm thông minh
        </Button>
        {draw?.drawScore != null && (
          <Chip label={`Balance score: ${draw.drawScore}`} color="primary" variant="outlined" />
        )}
        <Chip label={`Bảng: ${groups.length}`} size="small" variant="outlined" />
      </Stack>

      {groups.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Vòng đời bốc thăm
          </Typography>
          <DrawPublishControls
            tournament={tournament}
            groups={groups}
            drawPublish={drawPublish}
            hasReopenPermission={hasReopenPermission}
            onLock={lockDrawPublish}
            onPublish={publishDrawResult}
            onReopen={reopenDrawPublish}
            onForceRedraw={forceRedraw}
          />
          {drawPublish?.status === DRAW_PUBLISH_STATUS.PUBLISHED && drawPublish?.snapshot && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Snapshot bất biến đã lưu — {drawPublish.snapshot.length} bảng.
            </Alert>
          )}
        </Paper>
      )}

      {groups.length === 0 ? (
        <Alert severity="info">Chưa có bảng. Chạy hạt giống trước, rồi bốc thăm.</Alert>
      ) : (
        <Grid container spacing={2}>
          {groups.map((group) => (
            <Grid key={group.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Bảng {group.label || group.name}
                </Typography>
                <Stack spacing={0.5}>
                  {(group.entries || []).map((entry) => (
                    <Typography key={entry.id} variant="body2">
                      {entry.seed ? `#${entry.seed} ` : "• "}
                      {entry.name}
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {draw?.balance && !draw.balance.balanced && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Bảng lệch số lượng ({draw.balance.min}–{draw.balance.max} đội/bảng).
        </Alert>
      )}
    </Box>
  );
}
