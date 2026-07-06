import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { FEATURE_STATUS } from "../../config/v5Menu/menuBuilders.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { filterInPageNavHub, resolveRouteAccessScope } from "../../auth/menuAccess.js";
import TournamentPageHeader from "../tournament/TournamentPageHeader.jsx";
import {
  TOURNAMENT_HUB,
  tournamentCardContentSx,
  tournamentCardHoverSx,
  tournamentCardSx,
  tournamentHubTabSx,
} from "../tournament/tournamentLayout.js";
import "./inPageNavHubSlate.css";

function ItemBadge({ item }) {
  if (item.featureStatus === FEATURE_STATUS.PLANNED) {
    return (
      <Chip size="small" label="Sắp ra mắt" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 10 }} />
    );
  }
  if (item.featureStatus === FEATURE_STATUS.PARTIAL) {
    return (
      <Chip size="small" label="Một phần" variant="outlined" color="warning" sx={{ ml: 1, height: 20, fontSize: 10 }} />
    );
  }
  return null;
}

/**
 * Hub trong màn hình — tab + thẻ lựa chọn (sidebar tối đa 2 cấp).
 */
export default function InPageNavHub({ hub }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();

  const scope = resolveRouteAccessScope({
    user: auth.user,
    activeClubId,
    activeClub,
  });

  const filteredHub = useMemo(
    () =>
      filterInPageNavHub(hub, {
        can: auth.can,
        rbacEnabled: auth.rbacEnabled,
        isAuthenticated: auth.isAuthenticated,
        user: auth.user,
      }, scope),
    [hub, auth.can, auth.rbacEnabled, auth.isAuthenticated, auth.user, scope]
  );

  const sections = filteredHub?.sections || [];
  const defaultTab = sections[0]?.id || "";
  const tabParam = searchParams.get("tab") || defaultTab;
  const [tab, setTab] = useState(tabParam);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === tab) || sections[0],
    [sections, tab]
  );

  const handleTabChange = (_event, nextTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const handleItemClick = (item) => {
    if (item.featureStatus === FEATURE_STATUS.PLANNED) {
      navigate(`/coming-soon/${encodeURIComponent(item.key)}`);
      return;
    }
    if (!item.path) return;
    navigate(item.path);
  };

  if (!hub) {
    return <Alert severity="warning">Không tìm thấy cấu hình điều hướng.</Alert>;
  }

  if (!filteredHub?.sections?.length) {
    return (
      <Alert severity="warning">
        Bạn không có quyền truy cập các mục trong phần này.
      </Alert>
    );
  }

  return (
    <Box
      className="in-page-nav-hub in-page-nav-hub--slate"
      sx={{
        "--hub-accent-lime": TOURNAMENT_HUB.accent,
        "--hub-card-min-height": `${TOURNAMENT_HUB.cardMinHeight}px`,
      }}
    >
      <TournamentPageHeader
        title={filteredHub.title}
        description={filteredHub.description}
      />

      {sections.length > 1 ? (
        <Tabs value={tab} onChange={handleTabChange} sx={tournamentHubTabSx}>
          {sections.map((section) => (
            <Tab key={section.id} value={section.id} label={section.label} />
          ))}
        </Tabs>
      ) : null}

      <Box
        className="in-page-nav-hub__grid"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: TOURNAMENT_HUB.gridGap,
        }}
      >
        {(activeSection?.items || []).map((item) => {
          const plannedNoPath =
            !item.path && item.featureStatus === FEATURE_STATUS.PLANNED;
          return (
            <Card
              key={item.key}
              variant="outlined"
              elevation={0}
              sx={{
                ...tournamentCardSx,
                ...tournamentCardHoverSx,
              }}
            >
              <CardActionArea
                onClick={() => handleItemClick(item)}
                disabled={!item.path && !plannedNoPath}
                sx={{
                  height: "100%",
                  borderRadius: "inherit",
                  "&.Mui-disabled": { opacity: 0.55 },
                }}
              >
                <CardContent
                  sx={{
                    ...tournamentCardContentSx,
                    position: "relative",
                    minHeight: 72,
                    pr: 5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <Typography fontWeight={700} color="text.primary">
                      {item.text}
                    </Typography>
                    <ItemBadge item={item} />
                  </Box>
                  {item.featureNote ? (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {item.featureNote}
                    </Typography>
                  ) : null}
                  {item.path ? (
                    <ChevronRightIcon
                      fontSize="small"
                      sx={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "text.secondary",
                      }}
                    />
                  ) : null}
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
