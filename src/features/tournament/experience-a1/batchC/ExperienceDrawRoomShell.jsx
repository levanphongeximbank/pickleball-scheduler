import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import {
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { eventDisplayName } from "../batchB/eventScope.js";
import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { DRAW_LOCK_LABEL } from "./drawRoomActionState.js";
import { DRAW_ROOM_OUTLINED_SX } from "./drawRoomButtonStyles.js";

export function DrawPanel({ title, children, sx }) {
  return (
    <Box
      sx={{
        p: 1.25,
        mb: 1.25,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        bgcolor: TOURNAMENT_COLOR.drawSurface,
        border: "1px solid rgba(255,255,255,0.08)",
        ...sx,
      }}
    >
      {title ? (
        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, color: "#FFFFFF" }}>{title}</Typography>
      ) : null}
      {children}
    </Box>
  );
}

function DrawRoomHeader({ tournament, event, locked, expectedTotal, drawnCount, statusLabel }) {
  return (
    <Box
      sx={{
        mb: 1.25,
        p: 1.25,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        bgcolor: TOURNAMENT_COLOR.drawSurface,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.primaryLight, fontWeight: 700, letterSpacing: 0.5 }}>
            PHÒNG BỐC THĂM
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#FFF" }}>{tournament}</Typography>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>{event}</Typography>
        </Box>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {expectedTotal != null ? (
            <ExperienceStatusChip tone="info" label={`${drawnCount ?? 0}/${expectedTotal} cặp`} />
          ) : null}
          {locked ? (
            <ExperienceStatusChip tone="success" label="ĐÃ KHÓA" />
          ) : statusLabel ? (
            <ExperienceStatusChip tone="draft" label={statusLabel} />
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

export default function ExperienceDrawRoomShell({
  testId,
  title,
  subtitle = "Phòng bốc thăm",
  children,
  rail,
  locked = false,
  lockLabel = DRAW_LOCK_LABEL,
  lockDisabled = true,
  lockHint = "",
  undoHint = "",
  presentation,
  expectedTotal,
  drawnCount,
  tournamentName,
  eventName,
  statusLabel,
  overviewPath,
  extraNav,
  nextLifecycle,
}) {
  const [mode, setMode] = useState("operator");
  const navigate = useNavigate();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      data-testid={testId}
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.drawBg, color: TOURNAMENT_COLOR.navyText }}
    >
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800, color: "#FFF" }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted }}>{subtitle}</Typography>
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(overviewPath)} sx={DRAW_ROOM_OUTLINED_SX}>
              Tổng quan
            </Button>
            {mode === "operator" ? (
              <>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={mode}
                  onChange={(_e, value) => value && setMode(value)}
                  sx={{
                    "& .MuiToggleButton-root": {
                      color: TOURNAMENT_COLOR.navyTextMuted,
                      borderColor: "rgba(255,255,255,0.32)",
                      textTransform: "none",
                      px: 1.25,
                    },
                    "& .Mui-selected": { bgcolor: `${TOURNAMENT_COLOR.primary} !important`, color: "#FFF !important" },
                  }}
                >
                  <ToggleButton value="operator">Điều hành</ToggleButton>
                  <ToggleButton value="presentation">Trình chiếu</ToggleButton>
                </ToggleButtonGroup>
                <span title={undoHint}>
                  <Button variant="outlined" size="small" startIcon={<UndoIcon />} disabled sx={DRAW_ROOM_OUTLINED_SX}>
                    Hoàn tác
                  </Button>
                </span>
                <Button variant="outlined" size="small" startIcon={<SlideshowOutlinedIcon />} onClick={() => setMode("presentation")} sx={DRAW_ROOM_OUTLINED_SX}>
                  {isNarrow ? "Mở màn hình" : "Mở màn hình trình chiếu"}
                </Button>
                <span title={lockHint}>
                  <Button variant="outlined" size="small" startIcon={<LockOutlinedIcon />} disabled={lockDisabled} sx={DRAW_ROOM_OUTLINED_SX}>
                    {lockLabel}
                  </Button>
                </span>
                {nextLifecycle ? (
                  <span title={nextLifecycle.hint || undefined}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={nextLifecycle.disabled}
                      onClick={nextLifecycle.onClick}
                      sx={DRAW_ROOM_OUTLINED_SX}
                    >
                      {nextLifecycle.label}
                    </Button>
                  </span>
                ) : null}
              </>
            ) : (
              <Button size="small" variant="contained" onClick={() => setMode("operator")}>
                Thoát trình chiếu
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, minHeight: "70dvh", overflowX: "hidden" }}>
        {extraNav}
        <DrawRoomHeader
          tournament={tournamentName}
          event={eventName}
          locked={locked}
          expectedTotal={expectedTotal}
          drawnCount={drawnCount}
          statusLabel={statusLabel}
        />
        {mode === "presentation" && presentation ? (
          presentation
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: rail ? "minmax(0,1fr) 300px" : "1fr" },
              gap: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>{children}</Box>
            {rail ? <Box sx={{ minWidth: 0 }}>{rail}</Box> : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function DrawRoomSiblingNav({ items }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Button
          key={item.id}
          size="small"
          component={RouterLink}
          to={item.to}
          variant={item.current ? "contained" : "outlined"}
          sx={item.current ? undefined : DRAW_ROOM_OUTLINED_SX}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}

export function DrawRoomEventPicker({ events, selectedEventId, onSelect }) {
  if (!events?.length) {
    return (
      <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted, mb: 1 }}>
        Chưa có nội dung trên hồ sơ.
      </Typography>
    );
  }
  if (events.length === 1) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5, color: "#FFF" }}>Chọn nội dung</Typography>
      <ExperienceChipRow
        value={selectedEventId || ""}
        onChange={onSelect}
        items={events.map((event) => ({
          id: event.id,
          label: eventDisplayName(event),
        }))}
      />
    </Box>
  );
}
