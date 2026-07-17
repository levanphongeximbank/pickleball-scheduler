import { useMemo } from "react";
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SportsTennisRoundedIcon from "@mui/icons-material/SportsTennisRounded";

import { SHOWCASE_COPY, SHOWCASE_REVEAL_STEP_MS } from "./showcaseConstants.js";
import {
  buildShowcaseTeamRevealSteps,
  selectRevealedTeamState,
} from "./showcaseRevealSteps.js";
import { useShowcaseRevealPlayer } from "./useShowcaseRevealPlayer.js";

const LIME = "#9BFF21";
const GREEN = "#58F59A";
const MUTED = "rgba(225, 235, 249, 0.55)";
const DISPLAY_FONT = '"Arial Narrow", "Roboto Condensed", Impact, sans-serif';

function CeremonyBackdrop({ children }) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "calc(100vh - 64px)",
        overflow: "hidden",
        px: { xs: 1, md: 2 },
        py: { xs: 1.5, md: 2 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: [
            "radial-gradient(circle at 8% 12%, rgba(124,255,178,.13) 0 2px, transparent 3px)",
            "radial-gradient(circle at 88% 18%, rgba(124,255,178,.16) 0 2px, transparent 3px)",
            "linear-gradient(145deg, transparent 0 10%, rgba(124,255,178,.13) 10.2%, transparent 10.5%)",
            "linear-gradient(325deg, transparent 0 9%, rgba(124,255,178,.11) 9.2%, transparent 9.5%)",
            "radial-gradient(ellipse at 50% 110%, rgba(33,116,93,.22), transparent 55%)",
          ].join(","),
          backgroundSize: "83px 91px, 111px 103px, 100% 100%, 100% 100%, 100% 100%",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          left: "10%",
          right: "10%",
          bottom: 0,
          height: 90,
          borderTop: "1px solid rgba(124,255,178,.16)",
          transform: "perspective(280px) rotateX(55deg)",
          background:
            "repeating-linear-gradient(90deg, transparent 0 90px, rgba(124,255,178,.09) 91px 92px)",
          pointerEvents: "none",
        },
      }}
    >
      <Box sx={{ position: "relative", zIndex: 1 }}>{children}</Box>
    </Box>
  );
}

function AthletePortrait({ athlete, waiting = false }) {
  return (
    <Box
      sx={{
        width: { xs: 58, md: 78 },
        height: { xs: 66, md: 84 },
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        alignSelf: "stretch",
        overflow: "hidden",
        color: waiting ? "rgba(188,205,230,.28)" : GREEN,
        background:
          "linear-gradient(180deg, rgba(32,67,92,.1), rgba(19,43,65,.75))",
      }}
    >
      {athlete?.avatarUrl ? (
        <Box
          component="img"
          src={athlete.avatarUrl}
          alt=""
          sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
        />
      ) : (
        <PersonRoundedIcon sx={{ fontSize: { xs: 48, md: 66 }, opacity: waiting ? 0.55 : 0.8 }} />
      )}
    </Box>
  );
}

function FocusAthleteRow({ athlete, slotNumber, entering }) {
  const waiting = !athlete;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "58px 58px minmax(0,1fr)", md: "72px 78px minmax(0,1fr) 84px" },
        alignItems: "center",
        minHeight: { xs: 74, md: 88 },
        borderRadius: 1.5,
        overflow: "hidden",
        color: waiting ? MUTED : "#fff",
        border: entering
          ? `1px solid ${GREEN}`
          : "1px solid rgba(106,145,183,.28)",
        background: entering
          ? "linear-gradient(90deg, rgba(42,213,126,.26), rgba(11,43,50,.9) 55%, rgba(7,22,39,.96))"
          : "linear-gradient(90deg, rgba(14,31,53,.95), rgba(7,20,37,.9))",
        boxShadow: entering
          ? "0 0 18px rgba(88,245,154,.7), inset 0 0 16px rgba(88,245,154,.14)"
          : "none",
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          fontFamily: DISPLAY_FONT,
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: { xs: "2rem", md: "2.8rem" },
          color: entering ? "#06151d" : waiting ? "rgba(205,219,239,.36)" : "#fff",
          background: entering ? `linear-gradient(135deg, ${GREEN}, #2bc478)` : "rgba(6,17,31,.42)",
          position: "relative",
        }}
      >
        {slotNumber}
        {entering ? (
          <Typography
            sx={{
              position: "absolute",
              bottom: 4,
              fontSize: ".52rem",
              fontFamily: "inherit",
              fontStyle: "normal",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            ● VỪA VÀO
          </Typography>
        ) : null}
      </Box>
      <AthletePortrait athlete={athlete} waiting={waiting} />
      <Box sx={{ px: { xs: 1.2, md: 2 }, minWidth: 0 }}>
        {waiting ? (
          <>
            <Typography
              sx={{
                fontSize: { xs: "1rem", md: "1.3rem" },
                fontWeight: 900,
                fontStyle: "italic",
                color: "rgba(211,224,241,.48)",
              }}
            >
              Đang chờ...
            </Typography>
            <Typography noWrap sx={{ fontSize: { xs: ".7rem", md: ".86rem" }, color: MUTED }}>
              Vị trí đang chờ vận động viên tiếp theo
            </Typography>
          </>
        ) : (
          <>
            <Typography
              noWrap
              sx={{
                display: "inline-block",
                px: 0.75,
                mb: 0.25,
                borderRadius: 0.5,
                border: `1px solid ${GREEN}`,
                color: GREEN,
                fontSize: { xs: ".65rem", md: ".76rem" },
                lineHeight: 1.5,
                fontWeight: 800,
              }}
            >
              {athlete.id}
            </Typography>
            <Typography
              noWrap
              sx={{
                fontFamily: DISPLAY_FONT,
                fontSize: { xs: "1.08rem", md: "1.45rem" },
                lineHeight: 1.05,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              {athlete.name}
            </Typography>
            <Typography sx={{ color: GREEN, fontSize: { xs: ".72rem", md: ".84rem" }, fontWeight: 700 }}>
              {athlete.genderLabel} · Trình {Number(athlete.ratingValue || 0).toFixed(1)}
            </Typography>
          </>
        )}
      </Box>
      <SportsTennisRoundedIcon
        sx={{
          display: { xs: "none", md: "block" },
          justifySelf: "center",
          color: waiting ? "rgba(132,158,191,.35)" : GREEN,
          fontSize: 42,
          opacity: waiting ? 0.55 : 0.9,
        }}
      />
    </Box>
  );
}

function TeamShield({ number }) {
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        display: "grid",
        placeItems: "center",
        color: LIME,
        border: `2px solid ${LIME}`,
        clipPath: "polygon(50% 0, 94% 15%, 88% 72%, 50% 100%, 12% 72%, 6% 15%)",
        fontWeight: 900,
        fontSize: "1.25rem",
      }}
    >
      {number}
    </Box>
  );
}

function FinalTeamCard({ team, index }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: { xs: 1.25, md: 1.6 },
        border: "1px solid rgba(116,159,202,.42)",
        borderRadius: 1.5,
        background:
          "linear-gradient(145deg, rgba(10,31,57,.96), rgba(5,19,38,.96))",
        boxShadow: "inset 0 0 22px rgba(32,98,148,.08)",
      }}
    >
      <Stack direction="row" spacing={1.3} alignItems="center" pb={1.1} mb={0.7} sx={{ borderBottom: `1px solid rgba(155,255,33,.35)` }}>
        <TeamShield number={index + 1} />
        <Box>
          <Typography sx={{ color: LIME, fontSize: ".7rem", fontWeight: 900, lineHeight: 1 }}>
            ĐỘI
          </Typography>
          <Typography sx={{ color: LIME, fontFamily: DISPLAY_FONT, fontSize: "2.5rem", fontWeight: 900, lineHeight: .95 }}>
            {index + 1}
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={0}>
        {(team.athletes || []).map((athlete, athleteIndex) => (
          <Stack
            key={athlete.id}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              minHeight: 30,
              borderBottom:
                athleteIndex < team.athletes.length - 1
                  ? "1px solid rgba(117,151,184,.22)"
                  : "none",
            }}
          >
            <Box
              sx={{
                width: 21,
                height: 21,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: LIME,
                border: `1px solid ${LIME}`,
                fontSize: ".68rem",
                fontWeight: 900,
                flex: "0 0 auto",
              }}
            >
              {athleteIndex + 1}
            </Box>
            <Typography noWrap sx={{ fontSize: { xs: ".72rem", md: ".84rem" }, fontWeight: 700 }}>
              {athlete.name}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function CeremonyButton({ primary = false, icon, children, ...props }) {
  return (
    <Button
      {...props}
      startIcon={icon}
      size="large"
      sx={{
        minWidth: { xs: 210, md: 300 },
        minHeight: 56,
        px: 3,
        borderRadius: 1.5,
        border: primary ? `1px solid ${LIME}` : "1px solid rgba(255,255,255,.72)",
        background: primary ? `linear-gradient(180deg, ${LIME}, #69dc16)` : "rgba(5,18,36,.86)",
        color: primary ? "#051627" : "#fff",
        fontFamily: DISPLAY_FONT,
        fontSize: { xs: "1rem", md: "1.3rem" },
        fontWeight: 900,
        textTransform: "uppercase",
        boxShadow: primary ? "0 0 22px rgba(155,255,33,.18)" : "none",
        "&:hover": {
          background: primary ? "#adff45" : "rgba(14,35,61,.95)",
        },
      }}
    >
      {children}
    </Button>
  );
}

export default function ShowcaseTeamReveal({
  session,
  reducedMotion = false,
  stepMs = SHOWCASE_REVEAL_STEP_MS,
  onContinue,
  onClose,
  continueLabel = "Tiếp tục",
  closeLabel = SHOWCASE_COPY.back,
}) {
  const built = useMemo(() => buildShowcaseTeamRevealSteps(session), [session]);
  const total = built.ok ? built.steps.length : 0;
  const player = useShowcaseRevealPlayer({ total, reducedMotion, stepMs });
  const view = useMemo(
    () => selectRevealedTeamState(built, player.revealedCount),
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
  const activeTeam = view.teams[view.activeTeamIndex] || view.teams[0];
  const revealed = activeTeam?.revealedAthletes || [];
  const capacity = activeTeam?.athletes?.length || 4;
  const progress = total ? (view.revealedCount / total) * 100 : 0;

  return (
    <CeremonyBackdrop>
      {isComplete ? (
        <Stack spacing={{ xs: 1.5, md: 2.5 }} sx={{ maxWidth: 1180, mx: "auto" }}>
          <Box textAlign="center">
            <Typography
              component="h1"
              sx={{
                fontFamily: DISPLAY_FONT,
                fontStyle: "italic",
                fontSize: { xs: "2rem", md: "3.5rem" },
                fontWeight: 900,
                textTransform: "uppercase",
                textShadow: "0 4px 0 rgba(0,0,0,.38)",
              }}
            >
              Kết quả bốc thăm đội
            </Typography>
            <Box sx={{ width: 490, maxWidth: "80%", height: 3, mx: "auto", mt: .8, background: `linear-gradient(90deg, transparent, ${LIME}, transparent)` }} />
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" },
              gap: { xs: 1, md: 1.5 },
            }}
          >
            {view.teams.map((team, index) => (
              <FinalTeamCard key={team.id} team={team} index={index} />
            ))}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} justifyContent="center" alignItems="center">
            <CeremonyButton icon={<CloseRoundedIcon />} onClick={onClose}>
              {closeLabel}
            </CeremonyButton>
            <CeremonyButton primary icon={<EmojiEventsRoundedIcon />} onClick={onContinue}>
              {continueLabel}
            </CeremonyButton>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1.5} sx={{ maxWidth: 760, mx: "auto" }}>
          <Box textAlign="center">
            <Typography
              sx={{
                color: GREEN,
                fontFamily: DISPLAY_FONT,
                fontStyle: "italic",
                fontSize: { xs: "1rem", md: "1.25rem" },
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: ".05em",
              }}
            >
              Lễ công bố đội hình
            </Typography>
            <Typography sx={{ color: "#fff", fontStyle: "italic", fontWeight: 800, fontSize: { xs: ".8rem", md: "1rem" } }}>
              PICKLEBALL TEAM TOURNAMENT
            </Typography>
            <Typography
              component="h1"
              sx={{
                mt: .25,
                fontFamily: DISPLAY_FONT,
                fontStyle: "italic",
                fontSize: { xs: "3.8rem", md: "6rem" },
                lineHeight: .95,
                fontWeight: 900,
                textShadow: "0 5px 0 rgba(0,0,0,.34)",
              }}
            >
              {activeTeam?.name}
            </Typography>
            <Box sx={{ height: 3, background: `linear-gradient(90deg, transparent, ${GREEN}, #fff, ${GREEN}, transparent)`, boxShadow: `0 0 13px ${GREEN}` }} />
          </Box>

          <Stack
            spacing={0.7}
            sx={{
              p: { xs: 1, md: 1.5 },
              border: `1px solid ${GREEN}`,
              borderRadius: 2,
              background: "rgba(5,18,34,.82)",
              boxShadow: "0 0 32px rgba(88,245,154,.08)",
            }}
          >
            {Array.from({ length: capacity }, (_, index) => (
              <FocusAthleteRow
                key={activeTeam?.athletes?.[index]?.id || `empty-${index}`}
                athlete={revealed[index]}
                slotNumber={index + 1}
                entering={Boolean(
                  revealed[index] &&
                    String(revealed[index].id) === String(currentStep?.athleteId)
                )}
              />
            ))}
          </Stack>

          <Stack spacing={0.6} alignItems="center">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <GroupsRoundedIcon sx={{ color: GREEN, fontSize: 30 }} />
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: "1.75rem", fontWeight: 900 }}>
                <Box component="span" sx={{ color: GREEN }}>{view.revealedCount}</Box>
                <Box component="span" sx={{ mx: .6 }}>/</Box>
                <Box component="span">{total}</Box>
                <Box component="span" sx={{ ml: 1, color: GREEN, fontSize: "1rem" }}>VĐV</Box>
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                width: { xs: "88%", md: 410 },
                height: 8,
                borderRadius: 99,
                bgcolor: "rgba(111,143,182,.35)",
                "& .MuiLinearProgress-bar": { bgcolor: GREEN, borderRadius: 99 },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={2} justifyContent="center">
            <CeremonyButton
              icon={player.paused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
              onClick={player.paused ? player.resume : player.pause}
            >
              {player.paused ? "Tiếp tục" : "Tạm dừng"}
            </CeremonyButton>
            <CeremonyButton primary icon={<CloseRoundedIcon />} onClick={onClose}>
              Đóng
            </CeremonyButton>
          </Stack>
        </Stack>
      )}
    </CeremonyBackdrop>
  );
}
