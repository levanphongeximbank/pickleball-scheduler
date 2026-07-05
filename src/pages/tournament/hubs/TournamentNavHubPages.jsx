import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Tab, Tabs } from "@mui/material";

import InPageNavHub from "../../../components/nav/InPageNavHub.jsx";
import { TOURNAMENT_IN_PAGE_NAV } from "../../../config/v5Menu/tournamentInPageNav.js";
import { REPORTS_IN_PAGE_NAV } from "../../../config/v5Menu/reportsInPageNav.js";
import { AI_IN_PAGE_NAV } from "../../../config/v5Menu/aiInPageNav.js";
import { SUPPORT_IN_PAGE_NAV } from "../../../config/v5Menu/supportInPageNav.js";
import SupportGuidePage from "../../support/SupportGuidePage.jsx";
import SupportFaqPage from "../../support/SupportFaqPage.jsx";

const TAB_CONTENT = {
  guide: SupportGuidePage,
  faq: SupportFaqPage,
};

export function TournamentTypesHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.types} />;
}

export function TournamentRosterHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.roster} />;
}

export function TournamentOrganizeHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.organize} />;
}

export function TournamentOperationsHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.operations} />;
}

export function TournamentResultsHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.results} />;
}

export function TournamentConfigHubPage() {
  return <InPageNavHub hub={TOURNAMENT_IN_PAGE_NAV.config} />;
}

export function ReportsHubPage() {
  return <InPageNavHub hub={REPORTS_IN_PAGE_NAV} />;
}

export function AiHubPage() {
  return <InPageNavHub hub={AI_IN_PAGE_NAV} />;
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
