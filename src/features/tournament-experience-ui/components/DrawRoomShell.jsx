import { useState } from "react";
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
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";

import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "../drawRoom/drawRoomActionState.js";
import TournamentExperienceShell from "./TournamentExperienceShell.jsx";
import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { FixtureAuthorityNote } from "./prototypeSurfaces.jsx";
import { getFixtureTournament } from "../fixtures/prototypeFixture.js";

export default function DrawRoomShell({
  title,
  subtitle = "Phòng bốc thăm",
  children,
  rail,
  locked = false,
  onLock,
  onUndo,
  lockLabel = DRAW_LOCK_LABEL,
  lockDisabled,
  constraintsPass = true,
  expectedTotal,
  drawnCount,
  eventName = "Đôi nam 3.5",
  presentation,
  undoDisabled = false,
}) {
  const [mode, setMode] = useState("operator");
  const tournament = getFixtureTournament();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal,
    locked,
    constraintsPass,
  });
  const lockIsDisabled = lockDisabled ?? actionState.lockDisabled;

  return (
    <TournamentExperienceShell
      title={title}
      subtitle={subtitle}
      showEventContext
      actions={
        mode === "operator" ? (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_e, value) => value && setMode(value)}
              sx={{
                "& .MuiToggleButton-root": {
                  color: TOURNAMENT_COLOR.navyTextMuted,
                  borderColor: TOURNAMENT_COLOR.divider,
                  textTransform: "none",
                  px: 1.25,
                },
                "& .Mui-selected": { bgcolor: `${TOURNAMENT_COLOR.primary} !important`, color: "#FFF !important" },
              }}
            >
              <ToggleButton value="operator">Điều hành</ToggleButton>
              <ToggleButton value="presentation">Trình chiếu</ToggleButton>
            </ToggleButtonGroup>
            <Button variant="outlined" size="small" startIcon={<UndoIcon />} onClick={onUndo} disabled={locked || undoDisabled}>
              Hoàn tác
            </Button>
            <Button variant="outlined" size="small" startIcon={<SlideshowOutlinedIcon />} onClick={() => setMode("presentation")}>
              {isNarrow ? "Mở màn hình" : "Mở màn hình trình chiếu"}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LockOutlinedIcon />}
              disabled={lockIsDisabled}
              onClick={() => {
                if (lockIsDisabled) return;
                onLock?.();
              }}
            >
              {lockLabel}
            </Button>
          </Stack>
        ) : (
          <Button size="small" variant="contained" onClick={() => setMode("operator")}>
            Thoát trình chiếu
          </Button>
        )
      }
    >
      <Box
        sx={{
          mx: { xs: -1.5, md: -1.5, xl: -2 },
          mt: { xs: -1.5, md: -1.5, xl: -2 },
          mb: -2,
          px: { xs: 1.5, md: 2 },
          py: 1.5,
          minHeight: "70dvh",
          bgcolor: TOURNAMENT_COLOR.drawBg,
          color: TOURNAMENT_COLOR.navyText,
          overflowX: "hidden",
        }}
      >
        <FixtureAuthorityNote>Khóa kết quả bốc thăm chỉ là nguyên mẫu UX. Không tạo quyền bốc thăm thật.</FixtureAuthorityNote>
        <DrawRoomHeader
          tournament={tournament.name}
          event={eventName}
          locked={locked}
          expectedTotal={expectedTotal}
          drawnCount={drawnCount}
        />
        {locked ? (
          <Typography sx={{ color: TOURNAMENT_COLOR.success, fontWeight: 700, mb: 1, fontSize: 13 }}>
            Kết quả đã khóa trên dữ liệu mẫu — chỉ xem.
          </Typography>
        ) : null}
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
    </TournamentExperienceShell>
  );
}

function DrawRoomHeader({ tournament, event, locked, expectedTotal, drawnCount }) {
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
            <TournamentStatusChip tone="info" label={`${drawnCount ?? 0}/${expectedTotal} cặp`} />
          ) : null}
          <TournamentStatusChip tone={locked ? "success" : "draft"} label={locked ? "ĐÃ KHÓA" : "BẢN NHÁP"} />
        </Stack>
      </Stack>
    </Box>
  );
}

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
