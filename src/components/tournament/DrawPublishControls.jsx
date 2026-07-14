import {
  Alert,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PublishIcon from "@mui/icons-material/Publish";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import ReplayIcon from "@mui/icons-material/Replay";

import {
  canLockDraw,
  canPublishDraw,
  canReopenDraw,
  canForceRedraw,
  canRegenerateDraw,
  DRAW_PUBLISH_STATUS,
} from "../../tournament/engines/publishDrawEngine.js";

const STATUS_LABELS = {
  [DRAW_PUBLISH_STATUS.DRAFT]: "Nháp",
  [DRAW_PUBLISH_STATUS.LOCKED]: "Đã khóa",
  [DRAW_PUBLISH_STATUS.PUBLISHED]: "Đã công bố",
};

const STATUS_COLORS = {
  [DRAW_PUBLISH_STATUS.DRAFT]: "default",
  [DRAW_PUBLISH_STATUS.LOCKED]: "warning",
  [DRAW_PUBLISH_STATUS.PUBLISHED]: "success",
};

export default function DrawPublishControls({
  tournament,
  groups = [],
  drawPublish,
  hasReopenPermission = false,
  onLock,
  onPublish,
  onReopen,
  onForceRedraw,
  compact = false,
}) {
  const status = drawPublish?.status || DRAW_PUBLISH_STATUS.DRAFT;
  const lockCheck = canLockDraw(tournament, groups);
  const publishCheck = canPublishDraw(tournament, groups);
  const reopenCheck = canReopenDraw(tournament, { hasReopenPermission });
  const forceRedrawCheck = canForceRedraw(tournament, { hasReopenPermission });
  const regenCheck = canRegenerateDraw(tournament);

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={STATUS_LABELS[status] || status}
          color={STATUS_COLORS[status] || "default"}
          variant={status === DRAW_PUBLISH_STATUS.PUBLISHED ? "filled" : "outlined"}
        />
        {drawPublish?.publishedAt && (
          <Typography variant="caption" color="text.secondary">
            Công bố: {new Date(drawPublish.publishedAt).toLocaleString("vi-VN")}
          </Typography>
        )}
      </Stack>

      {!regenCheck.ok && status === DRAW_PUBLISH_STATUS.PUBLISHED && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Bốc thăm đã công bố — không thể chỉnh sửa. Chỉ Super Admin/Owner mới force redraw.
        </Alert>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {status === DRAW_PUBLISH_STATUS.DRAFT && (
          <Button
            size={compact ? "small" : "medium"}
            variant="outlined"
            startIcon={<LockIcon />}
            onClick={onLock}
            disabled={!lockCheck.ok}
            title={lockCheck.ok ? "" : lockCheck.error}
          >
            Khóa bốc thăm
          </Button>
        )}

        {status === DRAW_PUBLISH_STATUS.LOCKED && (
          <Button
            size={compact ? "small" : "medium"}
            variant="contained"
            color="success"
            startIcon={<PublishIcon />}
            onClick={onPublish}
            disabled={!publishCheck.ok}
            title={publishCheck.ok ? "" : publishCheck.error}
          >
            Công bố bốc thăm
          </Button>
        )}

        {(status === DRAW_PUBLISH_STATUS.LOCKED || status === DRAW_PUBLISH_STATUS.PUBLISHED) &&
          hasReopenPermission && (
            <Button
              size={compact ? "small" : "medium"}
              variant="outlined"
              color="warning"
              startIcon={<LockOpenIcon />}
              onClick={onReopen}
              disabled={!reopenCheck.ok}
              title={reopenCheck.ok ? "" : reopenCheck.error}
            >
              Mở lại
            </Button>
          )}

        {status === DRAW_PUBLISH_STATUS.PUBLISHED && hasReopenPermission && (
          <Button
            size={compact ? "small" : "medium"}
            variant="outlined"
            color="error"
            startIcon={<ReplayIcon />}
            onClick={onForceRedraw}
            disabled={!forceRedrawCheck.ok}
            title={forceRedrawCheck.ok ? "" : forceRedrawCheck.error}
          >
            Force redraw
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
