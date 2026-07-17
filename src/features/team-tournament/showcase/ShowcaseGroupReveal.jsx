import { useMemo } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SportsTennisRoundedIcon from "@mui/icons-material/SportsTennisRounded";

import { SHOWCASE_COPY } from "./showcaseConstants.js";
import {
  buildShowcaseGroupRevealSteps,
  selectRevealedGroupState,
} from "./showcaseRevealSteps.js";
import { useShowcaseRevealPlayer } from "./useShowcaseRevealPlayer.js";

const GREEN = "#58F59A";
const DISPLAY_FONT = '"Arial Narrow", "Roboto Condensed", Impact, sans-serif';

function CeremonyButton({ primary = false, icon, children, ...props }) {
  return (
    <Button
      {...props}
      startIcon={icon}
      size="large"
      sx={{
        minWidth: { xs: 180, md: 220 },
        minHeight: 54,
        px: 3,
        borderRadius: 1.5,
        border: primary ? `1px solid ${GREEN}` : "1px solid rgba(215,228,244,.48)",
        bgcolor: primary ? GREEN : "rgba(6,20,38,.9)",
        color: primary ? "#061527" : "#fff",
        fontFamily: DISPLAY_FONT,
        fontSize: "1.05rem",
        fontWeight: 900,
        textTransform: "none",
        "&:hover": { bgcolor: primary ? "#7affaf" : "rgba(13,35,60,.95)" },
      }}
    >
      {children}
    </Button>
  );
}

function GroupHeader({ name, active }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} justifyContent="center" mb={1.5}>
      <Box sx={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${active ? GREEN : "rgba(88,245,154,.42)"})` }} />
      <Typography
        sx={{
          color: active ? GREEN : "rgba(88,245,154,.8)",
          fontFamily: DISPLAY_FONT,
          fontSize: { xs: "1.65rem", md: "2rem" },
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </Typography>
      <Box sx={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${active ? GREEN : "rgba(88,245,154,.42)"}, transparent)` }} />
    </Stack>
  );
}

function GroupSlot({ team, index, entering }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "58px 56px minmax(0,1fr)",
        minHeight: { xs: 58, md: 65 },
        alignItems: "center",
        overflow: "hidden",
        borderRadius: 1.2,
        border: entering
          ? `1px solid ${GREEN}`
          : "1px solid rgba(116,155,196,.42)",
        bgcolor: team
          ? entering
            ? "rgba(40,173,105,.2)"
            : "rgba(18,57,62,.55)"
          : "rgba(5,17,34,.58)",
        boxShadow: entering ? "0 0 18px rgba(88,245,154,.28)" : "none",
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          fontFamily: DISPLAY_FONT,
          fontSize: { xs: "1.65rem", md: "2rem" },
          fontWeight: 900,
          color: team ? GREEN : "rgba(143,167,198,.45)",
          borderRight: "1px solid rgba(116,155,196,.25)",
        }}
      >
        {index + 1}
      </Box>
      <Box
        sx={{
          width: 38,
          height: 43,
          justifySelf: "center",
          display: "grid",
          placeItems: "center",
          color: team ? GREEN : "rgba(119,145,178,.42)",
        }}
      >
        {team ? (
          <Box
            sx={{
              width: 34,
              height: 38,
              display: "grid",
              placeItems: "center",
              clipPath: "polygon(50% 0, 94% 15%, 88% 72%, 50% 100%, 12% 72%, 6% 15%)",
              border: `2px solid ${GREEN}`,
              bgcolor: "rgba(88,245,154,.1)",
            }}
          >
            <SportsTennisRoundedIcon sx={{ fontSize: 21 }} />
          </Box>
        ) : (
          <ShieldOutlinedIcon sx={{ fontSize: 37 }} />
        )}
      </Box>
      <Typography
        noWrap
        sx={{
          px: 1,
          fontSize: { xs: ".95rem", md: "1.05rem" },
          fontWeight: 800,
          color: team ? "#fff" : "rgba(151,174,205,.42)",
        }}
      >
        {team?.name || "Đang chờ..."}
      </Typography>
    </Box>
  );
}

function GroupRevealCard({ group, active, currentTeamId, showComplete }) {
  const revealed = showComplete ? group.teams || [] : group.revealedTeams || [];
  const capacity = (group.teams || []).length || group.teamCount || 4;

  return (
    <Box
      sx={{
        minWidth: 0,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: active ? `1px solid ${GREEN}` : "1px solid rgba(91,192,255,.38)",
        bgcolor: "rgba(6,20,38,.83)",
        boxShadow: active
          ? "0 0 26px rgba(88,245,154,.18), inset 0 0 32px rgba(88,245,154,.04)"
          : "inset 0 0 32px rgba(40,92,137,.06)",
      }}
    >
      <GroupHeader name={group.name} active={active || showComplete} />
      <Stack spacing={1}>
        {Array.from({ length: capacity }, (_, index) => {
          const team = revealed[index];
          return (
            <GroupSlot
              key={team?.id || `empty-${index}`}
              team={team}
              index={index}
              entering={Boolean(
                !showComplete && team && String(team.id) === String(currentTeamId)
              )}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

export function ShowcaseGroupFormatSelect({
  options = [],
  engineVersion,
  rulesVersion,
  onSelect,
  onBack,
}) {
  return (
    <Stack spacing={3} alignItems="center">
      <Typography variant="h3" fontWeight={900}>Chọn định dạng chia bảng</Typography>
      <Typography color="text.secondary">
        engineVersion: {engineVersion || "—"} · rulesVersion: {rulesVersion || "—"}
      </Typography>
      <Stack spacing={1.5} width="100%" maxWidth={520}>
        {options.map((option) => (
          <Button key={option.groupCount} variant="contained" color="success" size="large" onClick={() => onSelect(option)}>
            {option.label}
          </Button>
        ))}
      </Stack>
      <Button variant="outlined" color="inherit" onClick={onBack}>Quay lại xem đội</Button>
    </Stack>
  );
}

export default function ShowcaseGroupReveal({
  session,
  seedingMode,
  engineVersion,
  rulesVersion,
  reducedMotion = false,
  onReselectFormat,
  onContinue,
  onClose,
  continueLabel = "Xem lại trước khi lưu",
  closeLabel = SHOWCASE_COPY.back,
}) {
  const built = useMemo(() => buildShowcaseGroupRevealSteps(session), [session]);
  const total = built.ok ? built.steps.length : 0;
  const player = useShowcaseRevealPlayer({ total, reducedMotion });
  const diagnostics = session?.groupSession?.diagnostics;
  const view = useMemo(
    () => selectRevealedGroupState(built, player.revealedCount),
    [built, player.revealedCount]
  );

  if (!built.ok) {
    return (
      <Stack spacing={2} alignItems="center">
        <Typography variant="h4">{built.error}</Typography>
        <Button onClick={onClose}>Đóng</Button>
      </Stack>
    );
  }

  const isComplete = player.isComplete;
  const currentStep = view.currentStep;
  const progress = total ? (view.revealedCount / total) * 100 : 0;

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "calc(100vh - 64px)",
        overflow: "hidden",
        maxWidth: 1180,
        mx: "auto",
        px: { xs: .5, md: 2 },
        py: { xs: 1.5, md: 2.5 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle at 5% 12%, rgba(88,245,154,.28) 0 1px, transparent 2px), radial-gradient(circle at 94% 18%, rgba(88,245,154,.24) 0 1px, transparent 2px), radial-gradient(ellipse at 50% 105%, rgba(27,110,89,.2), transparent 55%)",
          backgroundSize: "49px 53px, 59px 61px, 100% 100%",
        },
      }}
    >
      <Stack spacing={{ xs: 1.5, md: 2 }} sx={{ position: "relative", zIndex: 1 }}>
        <Box textAlign="center">
          <Typography
            component="h1"
            sx={{
              fontFamily: DISPLAY_FONT,
              fontSize: { xs: "2.4rem", md: "3.6rem" },
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {isComplete ? "Kết quả chia bảng" : "Đang chia bảng"}
          </Typography>
          <Typography sx={{ mt: .65, color: "rgba(219,231,247,.68)", fontSize: { xs: ".8rem", md: "1rem" } }}>
            {isComplete ? "Quá trình chia bảng đã hoàn tất" : "Quá trình chia bảng đang diễn ra"}
          </Typography>
          <Box sx={{ width: 520, maxWidth: "82%", height: 1, mx: "auto", mt: .6, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)` }} />

          {!isComplete && currentStep ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="center"
              sx={{
                width: "fit-content",
                mx: "auto",
                mt: 1.4,
                px: 2.2,
                py: .75,
                borderRadius: 1.2,
                border: `1px solid ${GREEN}`,
                bgcolor: "rgba(5,30,34,.72)",
                color: GREEN,
              }}
            >
              <CompareArrowsRoundedIcon />
              <Typography sx={{ fontSize: { xs: "1rem", md: "1.25rem" }, fontWeight: 900 }}>
                {currentStep.team?.name} <Box component="span" sx={{ color: "#fff", mx: .5 }}>→</Box> {currentStep.groupName}
              </Typography>
            </Stack>
          ) : null}

          <Typography sx={{ mt: 1, fontSize: { xs: ".9rem", md: "1.05rem" }, color: "rgba(235,242,251,.76)" }}>
            Tiến độ:{" "}
            <Box component="span" sx={{ color: GREEN, fontWeight: 900 }}>
              {view.revealedCount}/{total}
            </Box>{" "}
            đội
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              width: 280,
              maxWidth: "75%",
              height: 3,
              mx: "auto",
              mt: .6,
              bgcolor: "rgba(255,255,255,.08)",
              "& .MuiLinearProgress-bar": { bgcolor: GREEN },
            }}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: view.groups.length <= 2
                ? "repeat(2,minmax(0,1fr))"
                : "repeat(4,minmax(0,1fr))",
            },
            gap: 1.5,
          }}
        >
          {view.groups.map((group, index) => (
            <GroupRevealCard
              key={group.id}
              group={group}
              active={!isComplete && index === view.activeGroupIndex}
              currentTeamId={currentStep?.teamId}
              showComplete={isComplete}
            />
          ))}
        </Box>

        {isComplete && diagnostics && !diagnostics.complete ? (
          <Alert severity="warning">
            Chẩn đoán: thiếu {diagnostics.missingTeamIds?.length || 0}, trùng{" "}
            {diagnostics.duplicateTeamIds?.length || 0}
          </Alert>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" alignItems="center">
          {!isComplete ? (
            <>
              <CeremonyButton
                icon={player.paused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
                onClick={player.paused ? player.resume : player.pause}
              >
                {player.paused ? "Tiếp tục" : "Tạm dừng"}
              </CeremonyButton>
              <CeremonyButton primary icon={<CloseRoundedIcon />} onClick={onClose}>
                Đóng
              </CeremonyButton>
            </>
          ) : (
            <>
              <CeremonyButton icon={<CloseRoundedIcon />} onClick={onClose}>
                {closeLabel}
              </CeremonyButton>
              {onContinue ? (
                <CeremonyButton primary icon={<CompareArrowsRoundedIcon />} onClick={onContinue}>
                  {continueLabel}
                </CeremonyButton>
              ) : null}
              {onReselectFormat ? (
                <Button sx={{ color: GREEN }} onClick={onReselectFormat}>
                  Chọn lại 2 bảng / 4 bảng
                </Button>
              ) : null}
            </>
          )}
        </Stack>

        <Typography textAlign="center" sx={{ color: "rgba(205,220,239,.3)", fontSize: ".68rem" }}>
          {seedingMode || "auto-seeded"} · {engineVersion || "—"} · {rulesVersion || "—"}
        </Typography>
      </Stack>
    </Box>
  );
}
