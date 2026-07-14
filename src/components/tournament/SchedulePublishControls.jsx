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
  canLockSchedule,
  canPublishSchedule,
  canReopenSchedule,
  canForceRepublishSchedule,
  canRegenerateSchedule,
  SCHEDULE_PUBLISH_STATUS,
} from "../../tournament/engines/publishScheduleEngine.js";

const STATUS_LABELS = {
  [SCHEDULE_PUBLISH_STATUS.DRAFT]: "Nháp",
  [SCHEDULE_PUBLISH_STATUS.LOCKED]: "Đã khóa",
  [SCHEDULE_PUBLISH_STATUS.PUBLISHED]: "Đã công bố",
};

const STATUS_COLORS = {
  [SCHEDULE_PUBLISH_STATUS.DRAFT]: "default",
  [SCHEDULE_PUBLISH_STATUS.LOCKED]: "warning",
  [SCHEDULE_PUBLISH_STATUS.PUBLISHED]: "success",
};

export default function SchedulePublishControls({
  tournament,
  matches = [],
  schedulePublish,
  hasReopenPermission = false,
  onLock,
  onPublish,
  onReopen,
  onForceRepublish,
  compact = false,
}) {
  const status = schedulePublish?.status || SCHEDULE_PUBLISH_STATUS.DRAFT;
  const lockCheck = canLockSchedule(tournament, matches);
  const publishCheck = canPublishSchedule(tournament, matches);
  const reopenCheck = canReopenSchedule(tournament, { hasReopenPermission });
  const forceCheck = canForceRepublishSchedule(tournament, { hasReopenPermission });
  const regenCheck = canRegenerateSchedule(tournament);

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={STATUS_LABELS[status] || status}
          color={STATUS_COLORS[status] || "default"}
          variant={status === SCHEDULE_PUBLISH_STATUS.PUBLISHED ? "filled" : "outlined"}
        />
        {schedulePublish?.publishedAt && (
          <Typography variant="caption" color="text.secondary">
            Công bố: {new Date(schedulePublish.publishedAt).toLocaleString("vi-VN")}
          </Typography>
        )}
      </Stack>

      {!regenCheck.ok && status === SCHEDULE_PUBLISH_STATUS.PUBLISHED && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Lịch đã công bố — không thể chỉnh sửa. Chỉ Super Admin/Owner mới force republish.
        </Alert>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {status === SCHEDULE_PUBLISH_STATUS.DRAFT && (
          <Button
            size={compact ? "small" : "medium"}
            variant="outlined"
            startIcon={<LockIcon />}
            onClick={onLock}
            disabled={!lockCheck.ok}
            title={lockCheck.ok ? "" : lockCheck.error}
          >
            Khóa lịch
          </Button>
        )}

        {status === SCHEDULE_PUBLISH_STATUS.LOCKED && (
          <Button
            size={compact ? "small" : "medium"}
            variant="contained"
            color="success"
            startIcon={<PublishIcon />}
            onClick={onPublish}
            disabled={!publishCheck.ok}
            title={publishCheck.ok ? "" : publishCheck.error}
          >
            Công bố lịch
          </Button>
        )}

        {(status === SCHEDULE_PUBLISH_STATUS.LOCKED ||
          status === SCHEDULE_PUBLISH_STATUS.PUBLISHED) &&
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

        {status === SCHEDULE_PUBLISH_STATUS.PUBLISHED && hasReopenPermission && (
          <Button
            size={compact ? "small" : "medium"}
            variant="outlined"
            color="error"
            startIcon={<ReplayIcon />}
            onClick={onForceRepublish}
            disabled={!forceCheck.ok}
            title={forceCheck.ok ? "" : forceCheck.error}
          >
            Force republish
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
