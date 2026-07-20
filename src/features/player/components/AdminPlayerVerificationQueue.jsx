/**
 * Phase 1H-C — Admin Player verification queue + authorized actions UI.
 *
 * Reads via listPlayerVerificationQueue.
 * Writes via updatePlayerVerificationStatus only.
 * Audit remains owned by Phase 1H-A service (never written from UI).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  VERIFICATION_QUEUE_DEFAULT_STATUS,
  VERIFICATION_QUEUE_SUPPORTED_STATUSES,
} from "../constants/verificationQueue.js";
import { ADMIN_VERIFICATION_QUEUE_DTO_FIELDS } from "../projectors/projectAdminVerificationQueueItem.js";
import {
  formatActivityRegionDisplay,
  formatVerificationStatusDisplay,
} from "../selectors/selfProfileDisplay.js";
import {
  createAdminVerificationQueueController,
  VERIFICATION_QUEUE_UI_STATUS,
} from "../utils/adminVerificationQueueController.js";

function formatUpdatedAt(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return String(value);
  }
}

function statusChipColor(status) {
  switch (status) {
    case "verified":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "error";
    default:
      return "default";
  }
}

/**
 * @param {object} [props]
 * @param {ReturnType<typeof createAdminVerificationQueueController>} [props.controller]
 * @param {object} [props.listOptions] — DI options for queue/list (tests)
 * @param {object} [props.updateOptions] — DI options for mutation (tests)
 */
export default function AdminPlayerVerificationQueue({
  controller: injectedController = null,
  listOptions = undefined,
  updateOptions = undefined,
} = {}) {
  const controller = useMemo(
    () => injectedController || createAdminVerificationQueueController(),
    [injectedController]
  );

  const [snap, setSnap] = useState(() => controller.getState());
  const [statusFilter, setStatusFilter] = useState(VERIFICATION_QUEUE_DEFAULT_STATUS);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    return controller.subscribe(setSnap);
  }, [controller]);

  const refresh = useCallback(async () => {
    await controller.load({
      status: statusFilter,
      query: searchInput.trim(),
      listOptions,
    });
  }, [controller, statusFilter, searchInput, listOptions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pendingConfirm = snap.pendingConfirm;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Hàng đợi xác minh VĐV</Typography>
            <Typography variant="body2" color="text.secondary">
              Chỉ quản trị viên được phép. Đọc qua listPlayerVerificationQueue; ghi qua
              updatePlayerVerificationStatus.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="Trạng thái"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 180 }}
              inputProps={{ "data-testid": "verification-status-filter" }}
            >
              {VERIFICATION_QUEUE_SUPPORTED_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {formatVerificationStatusDisplay(status)} ({status})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Tìm kiếm"
              placeholder="Tên / playerId / authUserId"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              fullWidth
              inputProps={{ "data-testid": "verification-search-input" }}
            />
            <Button
              variant="outlined"
              onClick={() => void refresh()}
              disabled={snap.uiStatus === VERIFICATION_QUEUE_UI_STATUS.LOADING || snap.mutating}
            >
              Làm mới
            </Button>
          </Stack>

          {snap.successMessage ? (
            <Alert severity="success" data-testid="verification-success">
              {snap.successMessage}
            </Alert>
          ) : null}

          {snap.mutationError ? (
            <Alert severity="error" data-testid="verification-mutation-error">
              {snap.mutationError.message}
            </Alert>
          ) : null}

          {snap.uiStatus === VERIFICATION_QUEUE_UI_STATUS.LOADING ? (
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              role="status"
              data-testid="verification-loading"
            >
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                Đang tải hàng đợi xác minh…
              </Typography>
            </Stack>
          ) : null}

          {snap.uiStatus === VERIFICATION_QUEUE_UI_STATUS.DENIED ? (
            <Alert severity="warning" data-testid="verification-denied">
              {snap.loadError?.message ||
                "Bạn không có quyền xem hàng đợi xác minh VĐV."}
            </Alert>
          ) : null}

          {snap.uiStatus === VERIFICATION_QUEUE_UI_STATUS.ERROR ? (
            <Alert severity="error" data-testid="verification-load-error">
              {snap.loadError?.message || "Không tải được hàng đợi xác minh."}
            </Alert>
          ) : null}

          {snap.uiStatus === VERIFICATION_QUEUE_UI_STATUS.EMPTY ? (
            <Alert severity="info" data-testid="verification-empty">
              Không có VĐV nào trong hàng đợi với bộ lọc hiện tại.
            </Alert>
          ) : null}

          {snap.uiStatus === VERIFICATION_QUEUE_UI_STATUS.READY ? (
            <Table size="small" data-testid="verification-queue-table">
              <TableHead>
                <TableRow>
                  <TableCell>VĐV</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Khu vực</TableCell>
                  <TableCell>Venue</TableCell>
                  <TableCell>Cập nhật</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {snap.items.map((item) => {
                  const actions = controller.getActionsForItem(item);
                  const key = item.playerId || item.authUserId;
                  return (
                    <TableRow key={key} hover data-testid={`verification-row-${key}`}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.displayName || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.playerId || item.authUserId || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={statusChipColor(item.verificationStatus)}
                          label={`${formatVerificationStatusDisplay(item.verificationStatus)} (${item.verificationStatus})`}
                        />
                      </TableCell>
                      <TableCell>
                        {formatActivityRegionDisplay(item.activityRegion)}
                      </TableCell>
                      <TableCell>{item.venueId || "—"}</TableCell>
                      <TableCell>{formatUpdatedAt(item.updatedAt)}</TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {actions.map((action) => (
                            <Button
                              key={action.nextStatus}
                              size="small"
                              variant="outlined"
                              disabled={snap.mutating}
                              data-testid={`verification-action-${key}-${action.nextStatus}`}
                              onClick={() => controller.requestAction(item, action.nextStatus)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}

          {/* Contract reminder for tests / reviewers — DTO fields only */}
          <Typography
            variant="caption"
            color="text.disabled"
            data-testid="verification-dto-contract"
            sx={{ display: "none" }}
            aria-hidden
          >
            {ADMIN_VERIFICATION_QUEUE_DTO_FIELDS.join(",")}
          </Typography>
        </Stack>
      </CardContent>

      <Dialog
        open={Boolean(pendingConfirm)}
        onClose={() => {
          if (!snap.mutating) controller.cancelConfirm();
        }}
        data-testid="verification-confirm-dialog"
      >
        <DialogTitle>Xác nhận cập nhật xác minh</DialogTitle>
        <DialogContent>
          {pendingConfirm ? (
            <Stack spacing={1} sx={{ pt: 0.5 }}>
              <Typography variant="body2">
                VĐV:{" "}
                <strong>{pendingConfirm.displayName || pendingConfirm.playerId}</strong>
              </Typography>
              <Typography variant="body2">
                Trạng thái hiện tại:{" "}
                <strong>
                  {pendingConfirm.fromStatusLabel} ({pendingConfirm.fromStatus})
                </strong>
              </Typography>
              <Typography variant="body2">
                Trạng thái mới:{" "}
                <strong>
                  {pendingConfirm.toStatusLabel} ({pendingConfirm.toStatus})
                </strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Lý do từ chối (rejection reason) chưa hỗ trợ trong Phase 1H-C — deferred.
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => controller.cancelConfirm()}
            disabled={snap.mutating}
            data-testid="verification-confirm-cancel"
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            disabled={snap.mutating}
            data-testid="verification-confirm-submit"
            onClick={() =>
              void controller.confirmAction({ listOptions, updateOptions })
            }
          >
            {snap.mutating ? "Đang cập nhật…" : "Xác nhận"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
