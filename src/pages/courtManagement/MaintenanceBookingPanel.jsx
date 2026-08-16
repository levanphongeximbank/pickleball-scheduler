import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { createMaintenanceBooking } from "../../domain/bookingService.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { getCourtDisplayName } from "../../models/court.js";
import { isCanonicalPhysicalCourtId } from "../../features/court-resource/contracts/canonicalPhysicalCourt.js";
import {
  CANONICAL_RESOURCE_BLOCK_TYPE,
  isCanonicalResourceBlocks,
} from "../../features/court-resource/constants/canonicalResourceBlock.js";
import {
  cancelResourceBlock,
  createResourceBlock,
  listResourceBlocks,
  rescheduleResourceBlock,
  transferResourceBlock,
} from "../../features/court-resource/services/courtOperationsResourceBlockApplication.js";
import {
  buildEndTimeOptions,
  buildTimeOptions,
  todayIsoDate,
} from "./courtManagement.constants.js";

const BLOCK_TYPE_LABELS = {
  [CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE]: "Bảo trì (MAINTENANCE)",
  [CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK]: "Vận hành (OPERATIONAL_BLOCK)",
};

function defaultReason(blockType) {
  return blockType === CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK
    ? "Khóa vận hành"
    : "Bảo trì sân";
}

function formatBlockWindow(block) {
  const startsAt = block?.startsAt || block?.starts_at || "";
  const endsAt = block?.endsAt || block?.ends_at || "";
  if (!startsAt || !endsAt) return "—";
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startsAt} → ${endsAt}`;
  }
  const date = start.toISOString().slice(0, 10);
  const sh = String(start.getHours()).padStart(2, "0");
  const sm = String(start.getMinutes()).padStart(2, "0");
  const eh = String(end.getHours()).padStart(2, "0");
  const em = String(end.getMinutes()).padStart(2, "0");
  return `${date} ${sh}:${sm}–${eh}:${em}`;
}

function courtOptionId(court) {
  return court?.physicalCourtId || court?.id || "";
}

export default function MaintenanceBookingPanel({
  clubId,
  tenantId = null,
  courts = [],
  onSaved,
}) {
  const canonicalPath = isCanonicalResourceBlocks();
  const [blockType, setBlockType] = useState(CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE);
  const [date, setDate] = useState(todayIsoDate());
  const [courtId, setCourtId] = useState(
    courts[0]?.physicalCourtId || courts[0]?.id || ""
  );
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [activeBlocks, setActiveBlocks] = useState([]);
  const [listError, setListError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rescheduleDraft, setRescheduleDraft] = useState({});
  const [transferDraft, setTransferDraft] = useState({});

  const { startTimeOptions, endTimeOptions } = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);
    return {
      startTimeOptions: buildTimeOptions(settings.openHour, settings.closeHour),
      endTimeOptions: buildEndTimeOptions(settings.openHour, settings.closeHour),
    };
  }, [clubId]);

  const selectedCourt = useMemo(
    () =>
      courts.find(
        (court) =>
          court?.physicalCourtId === courtId || court?.id === courtId
      ) || null,
    [courts, courtId]
  );

  const refreshBlocks = useCallback(async () => {
    if (!canonicalPath || !tenantId || !clubId) {
      setActiveBlocks([]);
      return;
    }
    const listed = await listResourceBlocks({
      tenantId,
      clubId,
      includeCancelled: false,
      forceCanonical: true,
    });
    if (!listed.ok) {
      setListError(listed.message || listed.error || "Không tải được danh sách resource block.");
      setActiveBlocks([]);
      return;
    }
    setListError(null);
    const blocks = Array.isArray(listed.resourceBlocks) ? listed.resourceBlocks : [];
    setActiveBlocks(
      blocks.filter((block) => {
        const status = String(block?.lifecycleStatus || block?.lifecycle_status || "active").toLowerCase();
        return status === "active" || status === "scheduled";
      })
    );
  }, [canonicalPath, tenantId, clubId]);

  useEffect(() => {
    refreshBlocks();
  }, [refreshBlocks]);

  const handleSubmit = async () => {
    const physicalCourtId =
      selectedCourt?.physicalCourtId ||
      (isCanonicalPhysicalCourtId(courtId) ? courtId : "");
    const useCanonical =
      canonicalPath && Boolean(physicalCourtId) && isCanonicalPhysicalCourtId(physicalCourtId);

    if (useCanonical) {
      if (!tenantId) {
        setError("Thiếu tenantId — không thể tạo resource block canonical.");
        setMessage(null);
        return;
      }
      const displayName = selectedCourt
        ? getCourtDisplayName(selectedCourt, 0)
        : "";
      const reason = note.trim() || defaultReason(blockType);
      const result = await createResourceBlock({
        tenantId,
        clubId,
        physicalCourtId,
        date,
        startTime,
        endTime,
        blockType,
        reason,
        operatorNotes: reason,
        courtDisplayName: displayName,
        forceCanonical: true,
      });

      if (!result.ok) {
        setError(result.message || result.error || "Không tạo được resource block.");
        setMessage(null);
        return;
      }

      setError(null);
      setMessage(
        blockType === CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK
          ? "Đã tạo OPERATIONAL_BLOCK (canonical Resource Block)."
          : "Đã tạo MAINTENANCE (canonical Resource Block)."
      );
      await refreshBlocks();
      onSaved?.();
      return;
    }

    const result = await createMaintenanceBooking(
      {
        courtId,
        date,
        startTime,
        endTime,
        note: note.trim() || "Bảo trì sân",
      },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      setMessage(null);
      return;
    }

    setError(null);
    setMessage("Đã khóa sân bảo trì trên lịch booking.");
    onSaved?.();
  };

  const handleCancel = async (block) => {
    const resourceBlockId = block?.resourceBlockId || block?.id;
    if (!resourceBlockId || !tenantId) return;
    setBusyId(resourceBlockId);
    const result = await cancelResourceBlock({
      tenantId,
      resourceBlockId,
      forceCanonical: true,
      releaseReason: "resource_block_cancelled_ui",
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message || result.error || "Không hủy được resource block.");
      setMessage(null);
      return;
    }
    setError(null);
    setMessage("Đã hủy resource block và giải phóng capacity.");
    await refreshBlocks();
    onSaved?.();
  };

  const handleReschedule = async (block) => {
    const resourceBlockId = block?.resourceBlockId || block?.id;
    const draft = rescheduleDraft[resourceBlockId] || {};
    const physicalCourtId =
      block?.physicalCourtId || block?.physical_court_id || "";
    if (!resourceBlockId || !tenantId || !physicalCourtId) return;
    if (!draft.date || !draft.startTime || !draft.endTime) {
      setError("Nhập ngày / giờ mới để đổi lịch resource block.");
      setMessage(null);
      return;
    }
    setBusyId(resourceBlockId);
    const result = await rescheduleResourceBlock({
      tenantId,
      resourceBlockId,
      physicalCourtId,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      expectedVersion: block?.version ?? block?.expectedVersion,
      forceCanonical: true,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message || result.error || "Không đổi lịch được resource block.");
      setMessage(null);
      return;
    }
    setError(null);
    setMessage("Đã đổi lịch resource block.");
    await refreshBlocks();
    onSaved?.();
  };

  const handleTransfer = async (block) => {
    const resourceBlockId = block?.resourceBlockId || block?.id;
    const newPhysicalCourtId = transferDraft[resourceBlockId] || "";
    if (!resourceBlockId || !tenantId || !newPhysicalCourtId) {
      setError("Chọn sân đích để chuyển resource block.");
      setMessage(null);
      return;
    }
    setBusyId(resourceBlockId);
    const result = await transferResourceBlock({
      tenantId,
      resourceBlockId,
      newPhysicalCourtId,
      expectedVersion: block?.version ?? block?.expectedVersion,
      forceCanonical: true,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message || result.error || "Không chuyển sân được resource block.");
      setMessage(null);
      return;
    }
    setError(null);
    setMessage("Đã chuyển resource block sang sân khác.");
    await refreshBlocks();
    onSaved?.();
  };

  const submitLabel =
    !canonicalPath
      ? "Khóa bảo trì"
      : blockType === CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK
        ? "Tạo OPERATIONAL_BLOCK"
        : "Tạo MAINTENANCE";

  return (
    <Card variant="outlined" data-testid="resource-block-panel">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">
            {canonicalPath ? "Khóa sân (Resource Block)" : "Khóa sân bảo trì"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {canonicalPath
              ? "Canonical path: MAINTENANCE = bảo trì/sửa chữa; OPERATIONAL_BLOCK = khóa vận hành không phải bảo trì. Cùng lifecycle Resource Block + capacity SSOT."
              : "Tạo booking loại bảo trì để chặn khách đặt trùng giờ."}
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {listError && <Alert severity="warning">{listError}</Alert>}

          {canonicalPath && (
            <FormControl fullWidth data-testid="resource-block-type-select">
              <InputLabel>Loại khóa</InputLabel>
              <Select
                label="Loại khóa"
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
              >
                <MenuItem value={CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE}>
                  {BLOCK_TYPE_LABELS[CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE]}
                </MenuItem>
                <MenuItem value={CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK}>
                  {BLOCK_TYPE_LABELS[CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK]}
                </MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel>Sân</InputLabel>
            <Select label="Sân" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
              {courts.map((court, index) => (
                <MenuItem
                  key={courtOptionId(court)}
                  value={courtOptionId(court)}
                >
                  {getCourtDisplayName(court, index)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Ngày"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Từ giờ</InputLabel>
                <Select label="Từ giờ" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                  {startTimeOptions.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Đến giờ</InputLabel>
                <Select label="Đến giờ" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {endTimeOptions.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            placeholder={
              blockType === CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK
                ? "Ví dụ: Sự kiện nội bộ, khóa vận hành..."
                : "Ví dụ: Sửa mặt sân, thay lưới..."
            }
          />

          <Box>
            <Button
              variant="contained"
              color="warning"
              onClick={handleSubmit}
              data-testid="resource-block-create-button"
            >
              {submitLabel}
            </Button>
          </Box>

          {canonicalPath && (
            <>
              <Divider />
              <Typography variant="subtitle1">Resource Block đang hiệu lực</Typography>
              {activeBlocks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có resource block active.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {activeBlocks.map((block) => {
                    const resourceBlockId = block.resourceBlockId || block.id;
                    const type = String(block.blockType || block.block_type || "").toUpperCase();
                    const draft = rescheduleDraft[resourceBlockId] || {
                      date: todayIsoDate(),
                      startTime: "13:00",
                      endTime: "15:00",
                    };
                    return (
                      <Box
                        key={resourceBlockId}
                        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
                        data-testid={`resource-block-row-${resourceBlockId}`}
                      >
                        <Stack spacing={1.5}>
                          <Typography variant="body2">
                            <strong>{BLOCK_TYPE_LABELS[type] || type}</strong>
                            {" · "}
                            {formatBlockWindow(block)}
                            {" · "}
                            {block.physicalCourtId || block.physical_court_id}
                          </Typography>

                          <Grid container spacing={1}>
                            <Grid size={{ xs: 4 }}>
                              <TextField
                                label="Ngày mới"
                                type="date"
                                size="small"
                                fullWidth
                                value={draft.date}
                                InputLabelProps={{ shrink: true }}
                                onChange={(e) =>
                                  setRescheduleDraft((prev) => ({
                                    ...prev,
                                    [resourceBlockId]: { ...draft, date: e.target.value },
                                  }))
                                }
                              />
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Từ</InputLabel>
                                <Select
                                  label="Từ"
                                  value={draft.startTime}
                                  onChange={(e) =>
                                    setRescheduleDraft((prev) => ({
                                      ...prev,
                                      [resourceBlockId]: { ...draft, startTime: e.target.value },
                                    }))
                                  }
                                >
                                  {startTimeOptions.map((time) => (
                                    <MenuItem key={time} value={time}>
                                      {time}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Đến</InputLabel>
                                <Select
                                  label="Đến"
                                  value={draft.endTime}
                                  onChange={(e) =>
                                    setRescheduleDraft((prev) => ({
                                      ...prev,
                                      [resourceBlockId]: { ...draft, endTime: e.target.value },
                                    }))
                                  }
                                >
                                  {endTimeOptions.map((time) => (
                                    <MenuItem key={time} value={time}>
                                      {time}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={busyId === resourceBlockId}
                              onClick={() => handleReschedule(block)}
                              data-testid={`resource-block-reschedule-${resourceBlockId}`}
                            >
                              Đổi lịch
                            </Button>
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                              <InputLabel>Sân đích</InputLabel>
                              <Select
                                label="Sân đích"
                                value={transferDraft[resourceBlockId] || ""}
                                onChange={(e) =>
                                  setTransferDraft((prev) => ({
                                    ...prev,
                                    [resourceBlockId]: e.target.value,
                                  }))
                                }
                              >
                                {courts.map((court, index) => (
                                  <MenuItem key={courtOptionId(court)} value={courtOptionId(court)}>
                                    {getCourtDisplayName(court, index)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={busyId === resourceBlockId}
                              onClick={() => handleTransfer(block)}
                              data-testid={`resource-block-transfer-${resourceBlockId}`}
                            >
                              Chuyển sân
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={busyId === resourceBlockId}
                              onClick={() => handleCancel(block)}
                              data-testid={`resource-block-cancel-${resourceBlockId}`}
                            >
                              Hủy
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
