import { useMemo } from "react";



import { AppBar, Button, Chip, Stack, Toolbar, Typography } from "@mui/material";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";



import ClubSwitcher from "./ClubSwitcher";

import SeasonLeagueSwitcher from "./SeasonLeagueSwitcher";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../auth/roles.js";

import { useSeasonLeague } from "../context/SeasonContext.jsx";

import { getTodayCheckedInPlayerIds } from "../utils/playerHelpers.js";

import { computeCourtDashboardStats } from "../utils/courtHelpers.js";

import { loadCourtManagementData } from "../domain/bookingService.js";

import { loadCourts } from "../pages/courts.logic.js";

import sampleCourts from "../data/sampleCourts";



function CommandChip({ label, color = "default", pulse = false, hideOnMobile = false }) {

  return (

    <Chip

      size="small"

      label={label}

      color={color}

      variant={color === "default" ? "outlined" : "filled"}

      icon={

        pulse ? (

          <FiberManualRecordIcon

            sx={{

              fontSize: "10px !important",

              animation: "livePulse 1.8s ease-in-out infinite",

              "@keyframes livePulse": {

                "0%, 100%": { opacity: 1 },

                "50%": { opacity: 0.35 },

              },

            }}

          />

        ) : undefined

      }

      sx={{

        height: 26,

        fontWeight: 700,

        fontSize: 12,

        borderColor: color === "default" ? "rgba(255,255,255,0.35)" : undefined,

        color: color === "default" ? "rgba(255,255,255,0.9)" : undefined,

        display: hideOnMobile ? { xs: "none", md: "inline-flex" } : "inline-flex",

        ...(pulse && {

          bgcolor: "rgba(239, 68, 68, 0.9)",

          color: "#fff",

        }),

      }}

    />

  );

}



export default function Header() {

  const { activeClubId, summary } = useClub();
  const { rbacEnabled, isAuthenticated, user, signOut } = useAuth();

  const { activeSeason, activeLeague } = useSeasonLeague();



  const opsMeta = useMemo(() => {

    const courts = loadCourts(sampleCourts, activeClubId);

    const bookings = loadCourtManagementData(activeClubId).bookings;

    const courtStats = computeCourtDashboardStats(courts, bookings);

    const checkedInIds = getTodayCheckedInPlayerIds(activeClubId);

    const isLive = courtStats.playing > 0;



    return {

      playerCount: summary?.totals?.players ?? 0,

      courtCount: summary?.totals?.courts ?? 0,

      checkedInToday: checkedInIds.size,

      isLive,

    };

  }, [activeClubId, summary]);



  return (

    <AppBar

      position="fixed"

      elevation={0}

      sx={{

        zIndex: (theme) => theme.zIndex.drawer + 1,

        bgcolor: "#0f3f2e",

        background: "linear-gradient(90deg, #0f3f2e 0%, #157347 100%)",

        borderBottom: "1px solid rgba(255,255,255,0.08)",

      }}

    >

      <Toolbar

        sx={{

          gap: { xs: 1, md: 1.5 },

          minHeight: { xs: 56, sm: 64 },

          flexWrap: { xs: "wrap", lg: "nowrap" },

          py: { xs: 0.5, sm: 0 },

        }}

      >

        <Typography

          variant="subtitle1"

          noWrap

          sx={{

            fontWeight: 900,

            flexShrink: 0,

            display: { xs: "none", sm: "block" },

            fontSize: { sm: 15, md: 16 },

          }}

        >

          Pickleball Scheduler Pro

        </Typography>



        <Stack

          direction="row"

          spacing={0.75}

          sx={{

            ml: { xs: 0, sm: 1 },

            alignItems: "center",

            flexWrap: "wrap",

            flex: 1,

            minWidth: 0,

          }}

        >

          <ClubSwitcher />

          <SeasonLeagueSwitcher />

        </Stack>



        <Stack

          direction="row"

          spacing={0.5}

          alignItems="center"

          sx={{

            flexWrap: "wrap",

            justifyContent: { xs: "flex-start", lg: "flex-end" },

            width: { xs: "100%", lg: "auto" },

          }}

        >

          <CommandChip

            label={activeSeason?.name || "Mùa hiện tại"}

            hideOnMobile

          />

          <CommandChip

            label={activeLeague?.name || "Giao lưu"}

            hideOnMobile

          />

          {opsMeta.isLive && <CommandChip label="LIVE" pulse />}

          <CommandChip

            label={`${opsMeta.playerCount} người`}

            hideOnMobile

          />

          <CommandChip

            label={`${opsMeta.courtCount} sân`}

            hideOnMobile

          />

          {opsMeta.checkedInToday > 0 && (

            <CommandChip

              label={`${opsMeta.checkedInToday} check-in`}

              hideOnMobile

            />

          )}

          <Chip

            size="small"

            icon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}

            label="AI Ready"

            sx={{

              height: 26,

              fontWeight: 800,

              fontSize: 12,

              bgcolor: "rgba(255,255,255,0.15)",

              color: "#fff",

              "& .MuiChip-icon": { color: "#a5f3fc" },

            }}

          />

          {rbacEnabled && isAuthenticated && user && (

            <Chip

              size="small"

              label={ROLE_LABELS[user.role] || user.role}

              sx={{

                height: 26,

                fontWeight: 700,

                fontSize: 11,

                bgcolor: "rgba(255,255,255,0.22)",

                color: "#fff",

              }}

            />

          )}

          {rbacEnabled && isAuthenticated && (

            <Button

              size="small"

              color="inherit"

              onClick={() => signOut()}

              sx={{ minWidth: 0, fontSize: 11, fontWeight: 700, px: 1 }}

            >

              Đăng xuất

            </Button>

          )}

        </Stack>

      </Toolbar>

    </AppBar>

  );

}


