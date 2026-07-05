import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Alert, Box, Button, Grid, Typography } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Diversity3Icon from "@mui/icons-material/Diversity3";

import TournamentHome from "../TournamentHome.jsx";
import { TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import { listTournaments } from "../../../domain/tournamentService.js";
import { useClub } from "../../../context/ClubContext.jsx";
import ModeCard from "../../../components/tournament/ModeCard.jsx";
import { TOURNAMENT_ROUTES, isIndividualTournament, isTeamTournament } from "../../../config/tournamentRoutes.js";

const CREATE_OPTIONS = {
  individual: [
    {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      title: "Giải nội bộ CLB",
      description: "Giải cá nhân/đôi trong CLB — chia bảng, bracket nội bộ.",
      icon: <GroupsIcon />,
      color: "#16a34a",
      badge: "Cá nhân",
    },
    {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      title: "Giải chính thức / mở rộng",
      description: "Giải nhiều CLB, nhiều nội dung — Open hoặc AI Balance.",
      icon: <EmojiEventsIcon />,
      color: "#dc2626",
      badge: "Cá nhân",
    },
  ],
  team: [
    {
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      title: "Giải đồng đội",
      description: "Đội vs đội, đội hình, BXH đồng đội.",
      icon: <Diversity3Icon />,
      color: "#7c3aed",
      badge: "Đồng đội",
    },
  ],
};

export function TournamentTypePage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { activeClubId, revision } = useClub();

  const tournaments = useMemo(
    () => listTournaments(activeClubId),
    [activeClubId, revision]
  );

  const filtered = useMemo(() => {
    if (category === "team") {
      return tournaments.filter(isTeamTournament);
    }
    return tournaments.filter(isIndividualTournament);
  }, [tournaments, category]);

  const isTeam = category === "team";
  const title = isTeam ? "Giải đồng đội" : "Giải cá nhân / đôi";
  const description = isTeam
    ? "Tạo hoặc mở các giải đồng đội (team vs team)."
    : "Tạo hoặc mở các giải nội bộ và giải chính thức.";

  const createOptions = CREATE_OPTIONS[isTeam ? "team" : "individual"];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {createOptions.map((option) => (
          <Grid key={option.mode} size={{ xs: 12, md: 6 }}>
            <ModeCard
              title={option.title}
              description={option.description}
              icon={option.icon}
              color={option.color}
              badge={option.badge}
              onStart={() => navigate(TOURNAMENT_ROUTES.create)}
            />
          </Grid>
        ))}
      </Grid>

      {filtered.length === 0 ? (
        <Alert severity="info">Chưa có giải thuộc loại này.</Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 2 }}>
          Có {filtered.length} giải {isTeam ? "đồng đội" : "cá nhân/đôi"}. Xem trong Danh sách giải.
        </Alert>
      )}

      <Button variant="outlined" onClick={() => navigate(TOURNAMENT_ROUTES.list)}>
        Xem danh sách giải
      </Button>
    </Box>
  );
}

export function TournamentSectionPage({ section = "overview" }) {
  return <TournamentHome section={section} />;
}
