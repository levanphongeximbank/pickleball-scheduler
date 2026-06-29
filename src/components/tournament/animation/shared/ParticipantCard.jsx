import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonIcon from "@mui/icons-material/Person";
import { Box, Stack, Typography } from "@mui/material";

import StatusBadge from "./StatusBadge.jsx";

const DEFAULT_STATUS = {
  waiting: { label: "Chờ ghép", tone: "default" },
  active: { label: "Đang ghép", tone: "active" },
  done: { label: "Đã ghép", tone: "success" },
};

function resolveStatus({ isDone, isActive, statusLabels = DEFAULT_STATUS }) {
  if (isDone) {
    return statusLabels.done;
  }

  if (isActive) {
    return statusLabels.active;
  }

  return statusLabels.waiting;
}

export default function ParticipantCard({
  name,
  subtitle,
  gender,
  rating,
  level,
  seed,
  status,
  statusLabels,
  isActive = false,
  isDone = false,
  shaking = false,
  Icon = PersonIcon,
}) {
  const resolved = status || resolveStatus({ isDone, isActive, statusLabels });
  const displayLevel = rating ?? level;
  const IconComponent = Icon;

  return (
    <Box
      className={`tournament-waiting-item${
        isActive ? " tournament-waiting-item--highlight" : ""
      }${isDone ? " tournament-waiting-item--faded" : ""}${
        shaking ? " tournament-waiting-item--shake" : ""
      }`}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box className="tournament-participant-avatar">
          <IconComponent sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography
              variant="body2"
              fontWeight={isActive ? 700 : 500}
              sx={{ wordBreak: "break-word" }}
              title={name}
            >
              {name}
            </Typography>
            {isDone ? <CheckCircleIcon sx={{ fontSize: 16, color: "#2e7d32" }} /> : null}
          </Stack>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
              {subtitle}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
            {gender ? (
              <Typography variant="caption" color="text.secondary">
                {gender}
              </Typography>
            ) : null}
            {displayLevel != null && displayLevel !== "" ? (
              <Typography variant="caption" color="text.secondary">
                Level {displayLevel}
              </Typography>
            ) : null}
            {seed != null && seed !== "" ? (
              <Typography variant="caption" color="text.secondary">
                Seed {seed}
              </Typography>
            ) : null}
          </Stack>
          <Box sx={{ mt: 0.5 }}>
            <StatusBadge label={resolved.label} tone={resolved.tone} />
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

export const TEAM_WAITING_STATUS = {
  waiting: { label: "Chờ chia", tone: "default" },
  active: { label: "Đang chia", tone: "active" },
  done: { label: "Đã vào bảng", tone: "success" },
};
