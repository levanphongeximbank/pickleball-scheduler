import { useEffect, useState } from "react";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SkipNextIcon from "@mui/icons-material/SkipNext";

import CountdownDisplay from "./CountdownDisplay.jsx";
import TournamentFlowProgress from "./TournamentFlowProgress.jsx";
import {
  FLOW_HANDOFF_COUNTDOWN_SEC,
  getFlowPreparationMessage,
  getFlowStepLabel,
} from "./tournamentFlowConfig.js";

export default function FlowStepHandoff({
  completedStepKey,
  nextStepKey,
  summary,
  preparationMessage,
  countdownSeconds = FLOW_HANDOFF_COUNTDOWN_SEC,
  onContinue,
  onExit,
}) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const prepText = preparationMessage || getFlowPreparationMessage(nextStepKey);
  const progress =
    countdownSeconds > 0
      ? Math.round(((countdownSeconds - secondsLeft) / countdownSeconds) * 100)
      : 100;

  useEffect(() => {
    setSecondsLeft(countdownSeconds);
  }, [countdownSeconds, completedStepKey, nextStepKey, summary, preparationMessage]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onContinue?.();
      return undefined;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft, onContinue]);

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", py: { xs: 2, md: 3 } }}>
      <TournamentFlowProgress activeStepKey={nextStepKey} />

      <Stack spacing={2.5} alignItems="flex-start" sx={{ mt: 2 }}>
        <Box sx={{ width: "100%" }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            {prepText}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {summary}
          </Typography>
          {nextStepKey ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Tiếp theo: <strong>{getFlowStepLabel(nextStepKey)}</strong>
            </Typography>
          ) : null}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
          sx={{ width: "100%" }}
        >
          <CountdownDisplay
            secondsLeft={secondsLeft}
            totalSeconds={countdownSeconds}
            size="medium"
          />

          <Box sx={{ flex: 1, width: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
              <Typography variant="body2" fontWeight={700} color="primary.main">
                Chuyển sau {secondsLeft}s…
              </Typography>
              {completedStepKey ? (
                <Typography
                  variant="caption"
                  className="tournament-flow-step tournament-flow-step--done"
                  sx={{ px: 1, py: 0.25 }}
                >
                  Đã xong: {getFlowStepLabel(completedStepKey)}
                </Typography>
              ) : null}
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 99 }}
            />
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SkipNextIcon />}
            onClick={() => onContinue?.()}
          >
            Bỏ qua chờ
          </Button>
          <Button
            variant="text"
            color="inherit"
            startIcon={<ExitToAppIcon />}
            onClick={onExit}
          >
            Thoát trình chiếu
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
