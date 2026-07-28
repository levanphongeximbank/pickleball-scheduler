import Settings from "../Settings.jsx";
import SettingsRouteErrorBoundary from "../../components/settings/SettingsRouteErrorBoundary.jsx";

/** Route entry for /settings — error boundary wraps the page subtree. */
export default function SettingsRoute() {
  return (
    <SettingsRouteErrorBoundary>
      <Settings />
    </SettingsRouteErrorBoundary>
  );
}
