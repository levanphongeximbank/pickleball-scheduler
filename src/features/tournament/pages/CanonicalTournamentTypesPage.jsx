import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Alert, Box, Button, Grid } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Diversity3Icon from "@mui/icons-material/Diversity3";

import { useClub } from "../../../context/ClubContext.jsx";
import ModeCard from "../../../components/tournament/ModeCard.jsx";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import { TOURNAMENT_LAYOUT } from "../../../components/tournament/tournamentLayout.js";
import {
  TOURNAMENT_ROUTES,
  isIndividualTournament,
  isTeamTournament,
} from "../../../config/tournamentRoutes.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import { resolveEventTypeFromQuery } from "../../individual-tournament/index.js";
import { useCanonicalTournamentList } from "../hooks/useCanonicalTournament.js";
import { modeLabelVi } from "../constants/tournamentLabels.js";

const CREATE_OPTIONS = {
  individual: [
    {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      title: modeLabelVi(TOURNAMENT_MODE.INTERNAL_TOURNAMENT),
      description: "Giải cá nhân/đôi trong CLB — chia bảng, bracket nội bộ.",
      icon: <GroupsIcon sx={{ fontSize: 18 }} />,
      badge: "Cá nhân",
    },
    {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      title: modeLabelVi(TOURNAMENT_MODE.OFFICIAL_TOURNAMENT),
      description: "Giải nhiều CLB, nhiều nội dung — mở rộng hoặc cân bằng AI.",
      icon: <EmojiEventsIcon sx={{ fontSize: 18 }} />,
      badge: "Cá nhân",
    },
  ],
  team: [
    {
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      title: modeLabelVi(TOURNAMENT_MODE.TEAM_TOURNAMENT),
      description: "Đội vs đội, đội hình, Dreambreaker, BXH đồng đội.",
      icon: <Diversity3Icon sx={{ fontSize: 18 }} />,
      badge: "Đồng đội",
    },
  ],
};

export function CanonicalTournamentTypesHubPage() {
  const navigate = useNavigate();
  return (
    <Box>
      <TournamentPageHeader
        title="Loại hình giải"
        description="Chọn thể thức cá nhân/đôi hoặc đồng đội để tạo hoặc mở giải."
      />
      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ModeCard
            title="Giải cá nhân / đôi"
            description="Nội bộ hoặc chính thức / mở rộng."
            icon={<GroupsIcon sx={{ fontSize: 18 }} />}
            badge="Cá nhân"
            onStart={() => navigate(TOURNAMENT_ROUTES.typeIndividual)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ModeCard
            title="Giải đồng đội"
            description="Đội hình, Dreambreaker và bảng xếp hạng đồng đội."
            icon={<Diversity3Icon sx={{ fontSize: 18 }} />}
            badge="Đồng đội"
            onStart={() => navigate(TOURNAMENT_ROUTES.typeTeam)}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export function CanonicalTournamentTypePage() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, activeClubId, revision } = useClub();
  const eventQuery = resolveEventTypeFromQuery(searchParams.get("event"));
  const { tournaments } = useCanonicalTournamentList(activeClub || { id: activeClubId }, revision);

  const filtered = useMemo(() => {
    if (category === "team") return tournaments.filter(isTeamTournament);
    return tournaments.filter(isIndividualTournament);
  }, [tournaments, category]);

  const isTeam = category === "team";
  const title = isTeam ? "Giải đồng đội" : "Giải cá nhân / đôi";
  const description = isTeam
    ? "Tạo hoặc mở các giải đồng đội."
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
          Có {filtered.length} giải {isTeam ? "đồng đội" : "cá nhân/đôi"}.
        </Alert>
      )}

      <Button variant="outlined" onClick={() => navigate(TOURNAMENT_ROUTES.list)}>
        Xem danh sách giải
      </Button>
    </Box>
  );
}
