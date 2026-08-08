import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Tab, Tabs } from "@mui/material";

import InPageNavHub from "../../../components/nav/InPageNavHub.jsx";
import AiAlertsPanel from "../../../components/tournament/ai/AiAlertsPanel.jsx";
import { TOURNAMENT_IN_PAGE_NAV } from "../../../config/v5Menu/tournamentInPageNav.js";
import { AI_IN_PAGE_NAV } from "../../../config/v5Menu/aiInPageNav.js";
import { SUPPORT_IN_PAGE_NAV } from "../../../config/v5Menu/supportInPageNav.js";
import SupportGuidePage from "../../support/SupportGuidePage.jsx";
import SupportFaqPage from "../../support/SupportFaqPage.jsx";
import { ReportsWorkspacePage } from "../../../features/reporting-analytics/ui/index.js";

const TAB_CONTENT = {
  guide: SupportGuidePage,
  faq: SupportFaqPage,
};

export {
  CanonicalTournamentTypesHubPage as TournamentTypesHubPage,
} from "../../../features/tournament/pages/CanonicalTournamentTypesPage.jsx";

export {
  CanonicalTournamentRosterPage as TournamentRosterHubPage,
  CanonicalTournamentOrganizePage as TournamentOrganizeHubPage,
  CanonicalTournamentOperationsPage as TournamentOperationsHubPage,
  CanonicalTournamentResultsPage as TournamentResultsHubPage,
} from "../../../features/tournament/pages/CanonicalTournamentCapabilityPages.jsx";

export function TournamentConfigHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.config} />;
}

export function ReportsHubPage() {
  return <ReportsWorkspacePage />;
}

export function AiHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "hub";
  const focus = searchParams.get("focus") || "";
  const [tab, setTab] = useState(tabParam);

  useEffect(() => {
    if (tabParam) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (_event, nextTab) => {
    setTab(nextTab);
    if (nextTab === "hub") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: nextTab }, { replace: true });
    }
  };

  return (
    <Box>
      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab value="hub" label="Tổng quan" />
        <Tab value="alerts" label="Cảnh báo" />
      </Tabs>
      {tab === "alerts" ? (
        <AiAlertsPanel focus={focus} />
      ) : (
        <InPageNavHub hub={AI_IN_PAGE_NAV} />
      )}
      {tab === "hub" && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Gợi ý giải đấu chi tiết nằm trong màn hình tạo giải (nội bộ / chính thức) khi bật Trợ lý thông minh.
        </Alert>
      )}
    </Box>
  );
}

export function SupportHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "";
  const [tab, setTab] = useState(tabParam || "hub");

  useEffect(() => {
    if (tabParam && TAB_CONTENT[tabParam]) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const ContentComponent = useMemo(() => TAB_CONTENT[tab] || null, [tab]);

  const handleTabChange = (_event, nextTab) => {
    setTab(nextTab);
    if (nextTab === "hub") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: nextTab }, { replace: true });
    }
  };

  if (ContentComponent) {
    return (
      <Box>
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab value="hub" label="Tổng quan" />
          <Tab value="guide" label="Hướng dẫn" />
          <Tab value="faq" label="FAQ" />
        </Tabs>
        <ContentComponent />
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab value="hub" label="Tổng quan" />
        <Tab value="guide" label="Hướng dẫn" />
        <Tab value="faq" label="FAQ" />
      </Tabs>
      <InPageNavHub hub={SUPPORT_IN_PAGE_NAV} />
      <Alert severity="info" sx={{ mt: 2 }}>
        Chọn tab Hướng dẫn hoặc FAQ để xem nội dung chi tiết.
      </Alert>
    </Box>
  );
}
