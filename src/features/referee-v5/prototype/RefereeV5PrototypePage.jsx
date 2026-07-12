import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import RefereeV5Workspace from "../components/RefereeV5Workspace.jsx";

export default function RefereeV5PrototypePage() {
  const [searchParams] = useSearchParams();
  const [accessToken, setAccessToken] = useState(null);
  const stagingFixtureId = searchParams.get("fixture") || "staging-doubles";

  useEffect(() => {
    const client = getSupabaseAuthClient();
    if (!client) {
      return undefined;
    }

    client.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <RefereeV5Workspace
      showPrototypeBadge
      accessToken={accessToken}
      stagingFixtureId={stagingFixtureId}
    />
  );
}
