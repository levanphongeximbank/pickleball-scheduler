import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Alert, Box, Button, Grid } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Diversity3Icon from "@mui/icons-material/Diversity3";

import TournamentHome from "../TournamentHome.jsx";
import { TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import { listTournaments } from "../../../domain/tournamentService.js";
import { useClub } from "../../../context/ClubContext.jsx";
import ModeCard from "../../../components/tournament/ModeCard.jsx";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import { TOURNAMENT_LAYOUT } from "../../../components/tournament/tournamentLayout.js";
import { TOURNAMENT_ROUTES, isIndividualTournament, isTeamTournament } from "../../../config/tournamentRoutes.js";
import { resolveEventTypeFromQuery } from "../../../features/individual-tournament/index.js";

const CREATE_OPTIONS = {
  individual: [
    {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      title: "Giải nội bộ CLB",
      description: "Giải cá nhân/đôi trong CLB — chia bảng, bracket nội bộ.",
      icon: <GroupsIcon sx={{ fontSize: 18 }} />,
      badge: "Cá nhân",
    },
    {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      title: "Giải chính thức / mở rộng",
      description: "Giải nhiều CLB, nhiều nội dung — Open hoặc AI Balance.",
      icon: <EmojiEventsIcon sx={{ fontSize: 18 }} />,
      badge: "Cá nhân",
    },
  ],
  team: [
    {
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      title: "Giải đồng đội",
      description: "Đội vs đội, đội hình, BXH đồng đội.",
      icon: <Diversity3Icon sx={{ fontSize: 18 }} />,
      badge: "Đồng đội",
    },
  ],
};

export function TournamentTypePage() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClubId, revision } = useClub();
  const eventQuery = resolveEventTypeFromQuery(searchParams.get("event"));

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
    : eventQuery
      ? `Tạo giải với nội dung preselect: ${eventQuery}.`
      : "Tạo hoặc mở các giải nội bộ và giải chính thức.";

  const createOptions = CREATE_OPTIONS[isTeam ? "team" : "individual"];

  const createPath = eventQuery
    ? `${TOURNAMENT_ROUTES.create}?event=${eventQuery}`
    : TOURNAMENT_ROUTES.create;

  return (
    <Box>
      <TournamentPageHeader title={title} description={description} />

      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing} sx={{ mb: 3 }}>
        {createOptions.map((option) => (
          <Grid key={option.mode} size={{ xs: 12, md: 6 }}>
            <ModeCard
              title={option.title}
              description={option.description}
              icon={option.icon}
              mode={option.mode}
              badge={option.badge}
              onStart={() => navigate(createPath)}
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
