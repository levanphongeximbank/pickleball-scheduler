import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import TournamentEmptyState from "./TournamentEmptyState.jsx";
import TournamentSectionCard from "./TournamentSectionCard.jsx";
import { TournamentModeChip, TournamentStatusChip } from "./TournamentStatusChip.jsx";
import { touchButtonSx } from "./mobileUi.js";
import { tournamentModeAccent } from "./tournamentLayout.js";

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
  if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    return `/tournament/team/${tournament.id}`;
  }
  return "/tournament";
}

function ActiveTournamentRow({ tournament, onOpenDirector, navigate }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const accent = tournamentModeAccent(tournament.mode);
  const showEngine =
    tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT ||
    tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT;

  const handleDirector = () => {
    setMenuAnchor(null);
    if (onOpenDirector) {
      onOpenDirector(tournament);
      return;
    }
    navigate(`/tournament/director/${tournament.id}`);
  };

  const handleEngine = () => {
    setMenuAnchor(null);
    navigate(`/tournaments/${tournament.id}/engine`);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "stretch", md: "center" },
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 1 },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: accent.bg,
            color: accent.color,
            flexShrink: 0,
          }}
        >
          <EmojiEventsOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={700} sx={{ wordBreak: "break-word", lineHeight: 1.3 }}>
            {tournament.name}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            <TournamentModeChip mode={tournament.mode} />
            <TournamentStatusChip status={tournament.status} />
            {tournament.roundId ? (
              <Chip size="small" variant="outlined" label="Có vòng mùa" />
            ) : null}
          </Stack>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <Button
          variant="contained"
          endIcon={<ChevronRightIcon />}
          onClick={() => navigate(resolveTournamentPath(tournament))}
          sx={{ ...touchButtonSx, minWidth: { md: 140 } }}
        >
          Mở giải
        </Button>

        <PermissionGate
          permissions={[PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_UPDATE]}
        >
          <Tooltip title="Director">
            <Button
              variant="outlined"
              onClick={handleDirector}
              sx={{ ...touchButtonSx, display: { xs: "none", sm: "inline-flex" }, minWidth: 100 }}
            >
              Director
            </Button>
          </Tooltip>
        </PermissionGate>

        {showEngine ? (
          <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
            <Tooltip title="Engine 4.0">
              <IconButton
                onClick={handleEngine}
                sx={{ display: { xs: "none", sm: "inline-flex" }, ...touchButtonSx }}
              >
                <AutoAwesomeIcon />
              </IconButton>
            </Tooltip>
          </PermissionGate>
        ) : null}

        <IconButton
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ display: { xs: "inline-flex", sm: "none" }, ...touchButtonSx }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <PermissionGate
            permissions={[PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_UPDATE]}
          >
            <MenuItem onClick={handleDirector}>Director</MenuItem>
          </PermissionGate>
          {showEngine ? (
            <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
              <MenuItem onClick={handleEngine}>Engine 4.0</MenuItem>
            </PermissionGate>
          ) : null}
        </Menu>
      </Stack>
    </Box>
  );
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
    <TournamentSectionCard
      title={title}
      subtitle="Chuyển nhanh giữa các giải đang mở"
      badge={
        <Typography
          component="span"
          variant="caption"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 10,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontWeight: 700,
          }}
        >
          {activeTournaments.length} giải
        </Typography>
      }
    >
      {activeTournaments.length === 0 ? (
        <TournamentEmptyState
          title="Chưa có giải đang mở"
          description='Dùng "Tạo giải mới" hoặc mục Vui chơi mỗi ngày trong CLB.'
        />
      ) : (
        <Stack spacing={1.25}>
          {activeTournaments.map((tournament) => (
            <ActiveTournamentRow
              key={tournament.id}
              tournament={tournament}
              onOpenDirector={onOpenDirector}
              navigate={navigate}
            />
          ))}
        </Stack>
      )}
    </TournamentSectionCard>
  );
}
