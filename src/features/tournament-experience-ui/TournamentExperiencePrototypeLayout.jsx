import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { Outlet } from "react-router-dom";

import { createTournamentExperienceTheme } from "./design/tournamentTheme.js";

const theme = createTournamentExperienceTheme();

export default function TournamentExperiencePrototypeLayout() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Outlet />
    </ThemeProvider>
  );
}
