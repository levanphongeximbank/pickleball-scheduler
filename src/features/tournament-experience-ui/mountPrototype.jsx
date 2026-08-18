import ReactDOM from "react-dom/client";

import TournamentExperiencePrototypeApp from "./PrototypeApp.jsx";

export function mountTournamentExperiencePrototype() {
  const root = document.getElementById("root");
  ReactDOM.createRoot(root).render(<TournamentExperiencePrototypeApp />);
}
