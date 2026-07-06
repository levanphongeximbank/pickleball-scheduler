import TournamentHome from "./TournamentHome.jsx";

export default function TournamentShell({ section = "overview" }) {
  return <TournamentHome section={section} />;
}
