import { useCallback, useEffect, useMemo, useState } from "react";

import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";



import { Box, Alert, Stack, Tab, Tabs, Typography } from "@mui/material";



import { useClub } from "../../context/ClubContext.jsx";

import { useAuth } from "../../context/AuthContext.jsx";

import { isMenuItemVisible } from "../../auth/menuAccess.js";

import { COURT_MANAGEMENT_TABS } from "../../config/courtManagementTabs.js";

import { loadCourtManagementData, autoCompletePastBookings, autoStartDueBookings } from "../../domain/bookingService.js";

import { getUpcomingReminders, processBookingReminders } from "../../domain/bookingReminderService.js";

import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";

import { loadCourts } from "../courts.logic.js";

import CourtManagementSearchBar from "./CourtManagementSearchBar.jsx";



function resolveTabIndex(pathname, visibleTabs) {

  const index = visibleTabs.findIndex(

    (tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`)

  );

  return index >= 0 ? index : 0;

}



export default function CourtManagementLayout() {

  const { activeClubId, activeClub, revision, refreshClubs } = useClub();

  const auth = useAuth();

  const location = useLocation();

  const navigate = useNavigate();

  const [dataVersion, setDataVersion] = useState(0);

  const [reminderAlerts, setReminderAlerts] = useState([]);



  const scope = useMemo(

    () => ({

      clubId: activeClubId,

      venueId: activeClub?.venueId || auth.user?.venueId || null,

    }),

    [activeClubId, activeClub?.venueId, auth.user?.venueId]

  );



  const visibleTabs = useMemo(

    () =>

      COURT_MANAGEMENT_TABS.filter((tab) =>

        isMenuItemVisible(tab, { ...auth, scope })

      ),

    [auth, scope]

  );



  const courts = useMemo(

    () => loadCourts([], activeClubId),

    [activeClubId, revision, dataVersion]

  );



  const bookings = useMemo(() => {

    return loadCourtManagementData(activeClubId).bookings;

  }, [activeClubId, revision, dataVersion]);



  const handleRefresh = useCallback(() => {

    setDataVersion((value) => value + 1);

    refreshClubs();

  }, [refreshClubs]);



  useEffect(() => {

    setDataVersion((value) => value + 1);

  }, [activeClubId, revision]);



  useEffect(() => {

    if (!auth.rbacEnabled || !auth.isAuthenticated) {

      return;

    }



    const allowed = visibleTabs.some(

      (tab) =>

        location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`)

    );



    if (!allowed && visibleTabs[0]?.path) {

      navigate(visibleTabs[0].path, { replace: true });

    }

  }, [auth.rbacEnabled, auth.isAuthenticated, location.pathname, navigate, visibleTabs]);



  useEffect(() => {

    const settings = loadCourtManagementSettings(activeClubId);



    if (!settings.automationSettings?.autoCompleteOnOpen) {

      return;

    }



    const result = autoCompletePastBookings(activeClubId);



    if (result.updatedCount > 0) {

      setDataVersion((value) => value + 1);

      refreshClubs();

    }

  }, [activeClubId, refreshClubs]);



  useEffect(() => {

    const settings = loadCourtManagementSettings(activeClubId);



    if (!settings.notificationSettings?.enabled) {

      setReminderAlerts([]);

      return undefined;

    }



    const tick = () => {

      const currentSettings = loadCourtManagementSettings(activeClubId);



      if (!currentSettings.notificationSettings?.enabled) {

        setReminderAlerts([]);

        return;

      }



      const upcoming = getUpcomingReminders(activeClubId);



      if (currentSettings.notificationSettings.inAppNotify && upcoming.length > 0) {

        setReminderAlerts(upcoming);

      }



      processBookingReminders(activeClubId);

    };



    tick();

    const timer = window.setInterval(tick, 60_000);



    return () => window.clearInterval(timer);

  }, [activeClubId, dataVersion, revision]);



  useEffect(() => {

    const tick = () => {

      const settings = loadCourtManagementSettings(activeClubId);



      if (!settings.automationSettings?.autoStartPlaying) {

        return;

      }



      const result = autoStartDueBookings(activeClubId);



      if (result.updatedCount > 0) {

        setDataVersion((value) => value + 1);

        refreshClubs();

      }

    };



    tick();

    const timer = window.setInterval(tick, 60_000);



    return () => window.clearInterval(timer);

  }, [activeClubId, dataVersion, revision, refreshClubs]);



  const tabIndex = resolveTabIndex(location.pathname, visibleTabs);

  const isHomeTab = visibleTabs[tabIndex]?.path === "/court-management";



  return (

    <Box>

      {!isHomeTab && (

        <Stack spacing={1} sx={{ mb: 3 }}>

          <Typography variant="h4" fontWeight="bold">

            Quản lý sân

          </Typography>

          <Typography variant="body2" color="text.secondary">

            Đặt sân, khách hàng, doanh thu và vận hành nâng cao.

          </Typography>

        </Stack>

      )}



      {reminderAlerts.length > 0 && (

        <Stack spacing={1} sx={{ mb: 2 }}>

          {reminderAlerts.map((booking) => (

            <Alert

              key={booking.id}

              severity="info"

              onClose={() =>

                setReminderAlerts((current) => current.filter((item) => item.id !== booking.id))

              }

            >

              Booking sắp tới: {booking.customerName} · {booking.courtName || `Sân ${booking.courtId}`}{" "}

              · {booking.startTime}

            </Alert>

          ))}

        </Stack>

      )}



      <CourtManagementSearchBar clubId={activeClubId} bookings={bookings} />



      <Tabs

        value={tabIndex}

        onChange={(_, index) => navigate(visibleTabs[index]?.path || "/court-management")}

        variant="scrollable"

        scrollButtons="auto"

        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}

      >

        {visibleTabs.map((tab) => (

          <Tab

            key={tab.path}

            label={tab.label}

            component={RouterLink}

            to={tab.path}

            sx={{ textTransform: "none", fontWeight: 600 }}

          />

        ))}

      </Tabs>



      <Outlet

        context={{

          clubId: activeClubId,

          courts,

          bookings,

          revision: dataVersion,

          onRefresh: handleRefresh,

        }}

      />

    </Box>

  );

}


