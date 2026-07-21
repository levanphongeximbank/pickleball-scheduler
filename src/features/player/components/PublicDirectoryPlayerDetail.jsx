/**
 * Phase 1I-D — Authenticated Public Player Directory detail UI.
 * Calls the directory facade only through the detail controller (no direct RPC).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { Link as RouterLink } from "react-router-dom";

import {
  createPublicDirectoryDetailController,
  DIRECTORY_DETAIL_UI_STATUS,
} from "../utils/publicDirectoryDetailController.js";
import {
  DIRECTORY_DETAIL_NOT_FOUND_MESSAGE,
  DIRECTORY_DETAIL_PRIVACY_NOTICE,
} from "../utils/publicDirectoryDetailMessages.js";
import { PUBLIC_DIRECTORY_LIST_PATH } from "../utils/publicDirectoryRoutes.js";
import {
  formatDirectoryGenderLabel,
  formatDirectoryHandednessLabel,
} from "../utils/publicDirectoryListMessages.js";

function LoadingSkeleton() {
  return (
    <Box role="status" aria-busy="true" aria-label="Đang tải hồ sơ vận động viên">
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Skeleton variant="circular" width={72} height={72} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="45%" height={36} />
          <Skeleton variant="text" width="25%" height={24} />
        </Box>
      </Stack>
      <Skeleton variant="rounded" height={120} />
    </Box>
  );
}

/**
 * @param {object} [props]
 * @param {string} [props.playerId]
 * @param {ReturnType<typeof createPublicDirectoryDetailController>} [props.controller]
 * @param {object} [props.getOptions] — DI for facade (tests)
 */
export default function PublicDirectoryPlayerDetail({
  playerId,
  controller: injectedController = null,
  getOptions = undefined,
} = {}) {
  const controller = useMemo(
    () => injectedController || createPublicDirectoryDetailController(),
    [injectedController]
  );

  const [snap, setSnap] = useState(() => controller.getState());

  useEffect(() => {
    return controller.subscribe(setSnap);
  }, [controller]);

  useEffect(() => {
    const id = playerId == null ? "" : String(playerId);
    void controller.load(id, getOptions);
  }, [controller, playerId, getOptions]);

  const handleRetry = () => {
    void controller.retry(getOptions);
  };

  const displayName =
    String(snap.player?.displayName || "").trim() || "Vận động viên";
  const activityRegion =
    snap.player?.activityRegion == null || snap.player?.activityRegion === ""
      ? null
      : String(snap.player.activityRegion);
  const genderLabel = formatDirectoryGenderLabel(snap.player?.gender);
  const handednessLabel = formatDirectoryHandednessLabel(snap.player?.handedness);
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Box data-testid="public-player-directory-detail">
      <Button
        component={RouterLink}
        to={PUBLIC_DIRECTORY_LIST_PATH}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2.5, alignSelf: "flex-start" }}
        aria-label="Quay lại Danh bạ vận động viên"
      >
        Danh bạ vận động viên
      </Button>

      {snap.uiStatus === DIRECTORY_DETAIL_UI_STATUS.LOADING ? (
        <LoadingSkeleton />
      ) : null}

      {snap.uiStatus === DIRECTORY_DETAIL_UI_STATUS.UNAUTHENTICATED ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {snap.error?.message ||
            "Vui lòng đăng nhập để xem danh bạ vận động viên."}
        </Alert>
      ) : null}

      {snap.uiStatus === DIRECTORY_DETAIL_UI_STATUS.INVALID_REQUEST ? (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          {snap.error?.message ||
            "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại đường dẫn."}
        </Alert>
      ) : null}

      {snap.uiStatus === DIRECTORY_DETAIL_UI_STATUS.ERROR && snap.error ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            snap.error.recoverable ? (
              <Button
                color="inherit"
                size="small"
                onClick={handleRetry}
                aria-label="Thử lại tải hồ sơ vận động viên"
              >
                Thử lại
              </Button>
            ) : undefined
          }
        >
          {snap.error.message}
        </Alert>
      ) : null}

      {snap.uiStatus === DIRECTORY_DETAIL_UI_STATUS.NOT_FOUND ? (
        <Alert severity="info" role="status">
          {snap.error?.message || DIRECTORY_DETAIL_NOT_FOUND_MESSAGE}
        </Alert>
      ) : null}

      {snap.uiStatus === DIRECTORY_DETAIL_UI_STATUS.READY && snap.player ? (
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar
              src={snap.player.avatarUrl || undefined}
              alt={`Ảnh đại diện của ${displayName}`}
              sx={{ width: 72, height: 72, flexShrink: 0 }}
            >
              {initial}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography
                  variant="h5"
                  component="h1"
                  fontWeight={700}
                  sx={{ wordBreak: "break-word" }}
                >
                  {displayName}
                </Typography>
                {snap.player.isVerified === true ? (
                  <Tooltip title="Đã xác minh">
                    <VerifiedOutlinedIcon
                      color="primary"
                      fontSize="small"
                      aria-label="Đã xác minh"
                      data-testid="directory-detail-verified-badge"
                    />
                  </Tooltip>
                ) : null}
              </Stack>
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Thông tin công khai
            </Typography>
            <Stack spacing={1.25} divider={<Divider flexItem />}>
              {activityRegion ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
                    Khu vực hoạt động
                  </Typography>
                  <Typography variant="body1">{activityRegion}</Typography>
                </Stack>
              ) : null}
              {genderLabel ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
                    Giới tính
                  </Typography>
                  <Typography variant="body1">{genderLabel}</Typography>
                </Stack>
              ) : null}
              {handednessLabel ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
                    Tay thuận
                  </Typography>
                  <Typography variant="body1">{handednessLabel}</Typography>
                </Stack>
              ) : null}
              {!activityRegion && !genderLabel && !handednessLabel ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có thông tin công khai bổ sung.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <Alert severity="info" variant="outlined" icon={false}>
            {DIRECTORY_DETAIL_PRIVACY_NOTICE}
          </Alert>
        </Stack>
      ) : null}
    </Box>
  );
}
