import { useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import { touchButtonSx } from "./mobileUi.js";

const MODE_LABELS = {
  [TOURNAMENT_MODE.DAILY_PLAY]: "Daily",
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: "Nội bộ",
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: "Chính thức",
};

const STATUS_COLORS = {
  [TOURNAMENT_STATUS.ACTIVE]: "success",
  [TOURNAMENT_STATUS.READY]: "info",
  [TOURNAMENT_STATUS.REGISTRATION]: "warning",
  [TOURNAMENT_STATUS.DRAFT]: "default",
};

function resolveTournamentPath(tournament) {
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return `/tournament/official/${tournament.id}`;
  }
  return "/tournament";
}

export default function ActiveTournamentsPanel({
  title = "Giải đang vận hành",
  tournaments = [],
  onOpenDirector,
}) {
  const navigate = useNavigate();
  const activeTournaments = tournaments.filter(
    (tournament) =>
      tournament.status === TOURNAMENT_STATUS.ACTIVE ||
      tournament.status === TOURNAMENT_STATUS.READY ||
      tournament.status === TOURNAMENT_STATUS.REGISTRATION
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chuyển nhanh giữa các giải đang mở
          </Typography>
        </Box>
        <Chip label={`${activeTournaments.length} giải`} color="primary" />
      </Stack>

      {activeTournaments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có giải active/ready. Tạo giải mới tại menu Giải đấu.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {activeTournaments.map((tournament) => (
            <Paper key={tournament.id} variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight="bold" sx={{ wordBreak: "break-word" }}>
                      {tournament.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={MODE_LABELS[tournament.mode] || tournament.mode}
                      />
                      <Chip
                        size="small"
                        color={STATUS_COLORS[tournament.status] || "default"}
                        label={tournament.status}
                      />
                      {tournament.roundId ? (
                        <Chip size="small" variant="outlined" label="Có vòng mùa" />
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    endIcon={<ChevronRightIcon />}
                    sx={touchButtonSx}
                    onClick={() => navigate(resolveTournamentPath(tournament))}
                  >
                    Mở giải
                  </Button>
                  <PermissionGate
                    permissions={[
                      PERMISSIONS.TOURNAMENT_DIRECTOR,
                      PERMISSIONS.TOURNAMENT_MANAGE,
                    ]}
                  >
                  <PermissionGate
                    permissions={[
                      PERMISSIONS.TOURNAMENT_DIRECTOR,
                      PERMISSIONS.TOURNAMENT_MANAGE,
                    ]}
                  >
                    {onOpenDirector ? (
                      <Button
                        fullWidth
                        size="large"
                        variant="outlined"
                        sx={touchButtonSx}
                        onClick={() => onOpenDirector(tournament)}
                      >
                        Director
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        size="large"
                        variant="outlined"
                        sx={touchButtonSx}
                        onClick={() =>
                          navigate(`/tournament/director/${tournament.id}`)
                        }
                      >
                        Director
                      </Button>
                    )}
                  </PermissionGate>
                  </PermissionGate>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
