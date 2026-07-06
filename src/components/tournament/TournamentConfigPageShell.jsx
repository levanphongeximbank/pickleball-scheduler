import { Box } from "@mui/material";

import TournamentPageHeader from "./TournamentPageHeader.jsx";
import TournamentSectionCard from "./TournamentSectionCard.jsx";

export default function TournamentConfigPageShell({ title, description, children, noCard = false }) {
  return (
    <Box>
      <TournamentPageHeader title={title} description={description} />
      {noCard ? children : <TournamentSectionCard>{children}</TournamentSectionCard>}
    </Box>
  );
}
