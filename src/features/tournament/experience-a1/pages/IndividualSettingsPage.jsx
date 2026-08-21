import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import {
  individualPublicTournamentPath,
  isIndividualTournament,
} from "../../../../config/tournamentRoutes.js";
import {
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  OFFICIAL_MODE,
} from "../../../../models/tournament/constants.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  deriveFormatSteps,
  eventHasStartedCompetition,
  isInternalCompatibilityFamily,
  isOfficialOpenFamily,
  listTournamentEvents,
  MULTI_CONTENT_LIMITATION_INTERNAL,
  resolveSelectedEvent,
} from "../deriveOverview.js";
import { individualOverviewPath } from "../routes.js";
import {
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
} from "../../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  resolveTournamentExperienceAdapter,
  isOfficialTournamentExperience,
} from "../experienceModeResolver.js";
import OfficialContentFormatSettingsPanel from "../components/OfficialContentFormatSettingsPanel.jsx";
import {
  buildOfficialSettingsSavePatch,
  projectOfficialSettings,
} from "../../official-tournament-experience/officialExperienceCommands.js";
import {
  buildContentRulesSummaryLines,
  normalizeContentCompetitionRules,
} from "../../../individual-tournament/engines/officialContentCompetitionRules.js";
import {
  buildAddOfficialEventPatch,
  buildIdentityPatch,
  buildUpdateEventPatch,
} from "../settingsWriters.js";
import CenterIdentitySurface from "../visual/CenterIdentitySurface.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperiencePageHeader from "../visual/ExperiencePageHeader.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_RADIUS,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";
import { modeLabelVi, statusLabelVi } from "../../constants/tournamentLabels.js";

const TABS = [
  { id: "info", label: "Th?ng tin chung" },
  { id: "format", label: "Thi?t k? th? th?c" },
  { id: "rules", label: "Quy ??nh" },
  { id: "fees", label: "L? ph? & Gi?i th??ng" },
  { id: "schedule", label: "L?ch tr?nh" },
];

const OFFICIAL_MODE_LABELS = {
  [OFFICIAL_MODE.OPEN]: "M? r?ng",
  [OFFICIAL_MODE.AI_BALANCE]: "C?n b?ng AI",
};

const CONFIG_CARDS = [
  { title: "?? tu?i", detail: "M? trang quy ??nh ?? tu?i hi?n c?.", path: "/tournament/config/age-rules" },
  { title: "Gi?i t?nh", detail: "M? trang quy ??nh gi?i t?nh hi?n c?.", path: "/tournament/config/gender-rules" },
  { title: "?i?u ki?n tham gia", detail: "M? trang ?i?u ki?n tham gia hi?n c?.", path: "/tournament/eligibility/check" },
  { title: "M?u ?i?u l?", detail: "M? trang ?i?u l? hi?n c?.", path: "/tournament/config/regulations" },
];

function configPath(path, tournamentId) {
  const id = String(tournamentId || "").trim();
  return id ? `${path}?tournamentId=${encodeURIComponent(id)}` : path;
}

function FormatDesigner({ steps, locked = false, emptyText }) {
  return (
    <Box>
      <ExperienceSectionTitle
        action={locked ? <ExperienceStatusChip tone="success" label="?? KH?A" /> : null}
      >
        Thi?t k? th? th?c
      </ExperienceSectionTitle>
      {locked ? (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 1 }}>
          C?c c?u h?nh ?nh h??ng thi ??u ?? kh?a v? n?i dung ?? c? tr?n. Kh?ng ??i th? th?c tr?n m?n n?y.
        </Typography>
      ) : null}
      {steps.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
          {emptyText}
        </Typography>
      ) : (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          useFlexGap
          sx={{ alignItems: { xs: "stretch", md: "center" }, flexWrap: { xs: "nowrap", md: "wrap" } }}
        >
          {steps.map((step, index) => (
            <Stack
              key={step.id}
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ alignItems: { xs: "stretch", md: "center" } }}
            >
              <ExperienceOperatorCard
                sx={{
                  minWidth: { xs: 0, md: 128 },
                  textAlign: "center",
                  bgcolor: index === 0 ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
                  borderColor: index === 0 ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider,
                }}
              >
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>B??c {index + 1}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{step.label}</Typography>
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{step.vi}</Typography>
              </ExperienceOperatorCard>
              {index < steps.length - 1 ? (
                <ArrowForwardIcon
                  sx={{
                    display: { xs: "none", md: "block" },
                    color: TOURNAMENT_COLOR.primary,
                    fontSize: 18,
                  }}
                />
              ) : null}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function SettingsShell({ children, actions, contextLine }) {
  return (
    <Box
      data-testid="tournament-settings-page"
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.pageBg }}
    >
      <ExperiencePageHeader
        title="C?i ??t Gi?i ??u / N?i dung"
        subtitle="C?i ??t gi?i ??u t?ch c?i ??t n?i dung"
        contextLine={contextLine}
        actions={actions}
      />
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>{children}</Box>
    </Box>
  );
}

export default function IndividualSettingsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(activeClub, tournamentId);
  const [scope, setScope] = useState(searchParams.get("eventId") ? "event" : "tournament");
  const initialTab = (() => {
    const raw = String(searchParams.get("tab") || "").trim();
    return TABS.some((row) => row.id === raw) ? raw : "info";
  })();
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [hostClubName, setHostClubName] = useState("");
  const [officialMode, setOfficialMode] = useState(OFFICIAL_MODE.OPEN);
  const [eventType, setEventType] = useState(EVENT_TYPE.MEN_DOUBLE);
  const [addEventType, setAddEventType] = useState(EVENT_TYPE.MEN_DOUBLE);
  const [addEventName, setAddEventName] = useState("");
  const [addRegistrationMode, setAddRegistrationMode] = useState(
    OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
  );
  const [eventName, setEventName] = useState("");
  const [contentRulesDraft, setContentRulesDraft] = useState(() =>
    normalizeContentCompetitionRules({})
  );
  const [rulesBootstrapSource, setRulesBootstrapSource] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedEventId = searchParams.get("eventId") || "";
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const official = isOfficialOpenFamily(tournament);
  const internal = isInternalCompatibilityFamily(tournament);
  const competitionLocked = Boolean(selectedEvent && eventHasStartedCompetition(selectedEvent));
  const formatSteps = deriveFormatSteps(selectedEvent);
  const officialAdapter =
    tournament && isOfficialTournamentExperience(tournament)
      ? resolveTournamentExperienceAdapter(tournament, { selectedEventId })
      : null;
  const officialSettingsProjection =
    tournament && official
      ? projectOfficialSettings(tournament, { selectedEventId })
      : null;
  const scoringCaps = officialSettingsProjection?.scoringCapabilities || {};
  const rulesAdoption = officialSettingsProjection?.rulesAdoption || null;

  useEffect(() => {
    if (!tournament || dirty) return;
    setName(tournament.name || "");
    setHostClubName(tournament.hostClubName || "");
    setOfficialMode(tournament.officialMode || OFFICIAL_MODE.OPEN);
    if (!isOfficialOpenFamily(tournament)) return;

    const projected = projectOfficialSettings(tournament, {
      selectedEventId,
    });
    const draft = projected?.rulesAdoption?.formDraft;
    const competition = projected?.competition;
    if (!competition && !draft && !selectedEventId) {
      setRulesBootstrapSource(null);
      return;
    }

    setContentRulesDraft(
      normalizeContentCompetitionRules({
        registrationMode:
          draft?.registrationMode ||
          competition?.registrationMode ||
          OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        matchScoring: {
          scoringMethod:
            draft?.scoringMethod ||
            competition?.scoringMethod ||
            OFFICIAL_SCORING_METHOD.RALLY,
          matchFormat:
            draft?.matchFormat ||
            competition?.matchFormat ||
            OFFICIAL_MATCH_FORMAT.BEST_OF_1,
          targetPoints: draft?.targetPoints ?? competition?.roundTargets?.group ?? 11,
          winCondition: {
            winByEnabled: draft?.winByEnabled !== false,
            winByMargin: draft?.winByMargin ?? competition?.winByMargin ?? 2,
            pointCapEnabled: draft?.pointCapEnabled === true,
            pointCap: draft?.pointCap ?? competition?.pointCap ?? null,
          },
          changeEnd: {
            changeEndsEnabled: draft?.changeEndsEnabled === true,
            changeEndsAtPoints: draft?.changeEndsAtPoints ?? null,
            changeEndsBetweenGames: true,
            decidingGameChangeEndsAt: null,
          },
        },
        stageOverrides: draft?.stageOverrides || competition?.stageOverrides,
        roundTargets: draft?.roundTargets || competition?.roundTargets,
        groupStage: {
          groupCount: draft?.groupCount ?? competition?.groupCount ?? 4,
          groupStageEnabled: draft?.groupStageEnabled !== false,
          maxUnitsPerGroup: draft?.maxUnitsPerGroup ?? null,
          allowUnevenGroups: draft?.allowUnevenGroups !== false,
        },
        qualification: {
          directQualifiersPerGroup:
            draft?.qualifiersPerGroup ?? competition?.qualifiersPerGroup ?? 2,
          totalQualifiers: draft?.totalQualifiers ?? null,
        },
        knockout: {
          knockoutEnabled: draft?.knockoutEnabled !== false,
          pairingPolicy: draft?.pairingPolicy,
          avoidSameGroupFirstRound: draft?.avoidSameGroupFirstRound,
        },
        eligibility: {
          minLevel: draft?.minLevel ?? projected?.eligibility?.minLevel ?? null,
          maxLevel: draft?.maxLevel ?? projected?.eligibility?.maxLevel ?? null,
          minRating: draft?.minRating ?? projected?.eligibility?.minRating ?? null,
          maxRating: draft?.maxRating ?? projected?.eligibility?.maxRating ?? null,
        },
        capacity: draft?.capacity,
        seedingPolicy: draft?.seedingPolicy,
        inGroupTieBreak: draft?.inGroupTieBreak,
        crossGroupRanking: draft?.crossGroupRanking,
        walkover: draft?.walkover,
        checkIn: draft?.checkIn,
        substitution: draft?.substitution,
        scheduleConstraints: draft?.scheduleConstraints,
        courtRequirement: draft?.courtRequirement,
        refereeRequirement: draft?.refereeRequirement || competition?.refereeRequirement,
        publication: draft?.publication,
      })
    );
    setRulesBootstrapSource(
      draft?.source || competition?.source || "canonical.system.default"
    );
  }, [tournament, dirty, selectedEventId]);

  useEffect(() => {
    if (dirty) return;
    if (selectedEvent) {
      setEventName(selectedEvent.name || "");
      setEventType(selectedEvent.eventType || EVENT_TYPE.MEN_DOUBLE);
    } else {
      setEventName("");
    }
  }, [selectedEvent, dirty]);

  useEffect(() => {
    // Isolate form draft when switching N?i dung ? do not leak edits across events.
    setDirty(false);
  }, [selectedEventId]);

  useEffect(() => {
    const raw = String(searchParams.get("tab") || "").trim();
    const nextTab = TABS.some((row) => row.id === raw) ? raw : "info";
    setTab(nextTab);
  }, [searchParams]);

  const persist = async (patch, successText) => {
    setBusy(true);
    setMessage(null);
    const result = await update(patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Kh?ng l?u ???c." });
      return false;
    }
    setDirty(false);
    refreshClubs();
    setMessage({ type: "success", text: successText });
    return true;
  };

  const buildOfficialDraftPayload = () => {
    const normalized = normalizeContentCompetitionRules(contentRulesDraft);
    return {
      name,
      hostClubName,
      officialMode,
      eventId: selectedEventId,
      selectedEventId,
      contentRules: normalized,
      registrationMode: normalized.registrationMode,
      groupCount: normalized.groupStage.groupCount,
      qualifiersPerGroup: normalized.qualification.directQualifiersPerGroup,
      totalQualifiers: normalized.qualification.totalQualifiers,
      scoringMethod: normalized.matchScoring.scoringMethod,
      matchFormat: normalized.matchScoring.matchFormat,
      targetPoints: normalized.matchScoring.targetPoints,
      roundTargets: normalized.roundTargets,
      stageOverrides: normalized.stageOverrides,
      winByEnabled: normalized.matchScoring.winCondition.winByEnabled,
      winByMargin: normalized.matchScoring.winCondition.winByMargin,
      pointCapEnabled: normalized.matchScoring.winCondition.pointCapEnabled,
      pointCap: normalized.matchScoring.winCondition.pointCap,
      changeEndsEnabled: normalized.matchScoring.changeEnd.changeEndsEnabled,
      changeEndsAtPoints: normalized.matchScoring.changeEnd.changeEndsAtPoints,
      maxLevel: normalized.eligibility.maxLevel,
      maxRating: normalized.eligibility.maxRating,
      minLevel: normalized.eligibility.minLevel,
      minRating: normalized.eligibility.minRating,
    };
  };

  const setContentDraft = (updater) => {
    setDirty(true);
    setContentRulesDraft((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return normalizeContentCompetitionRules(next);
    });
  };

  const setSettingsTab = (nextTab) => {
    setTab(nextTab);
    const next = new URLSearchParams(searchParams);
    if (nextTab && nextTab !== "info") next.set("tab", nextTab);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const handleSaveIdentity = async () => {
    if (official) {
      // Tournament scope: identity only ? no competition-rules mutation.
      const patch = buildIdentityPatch({
        name,
        hostClubName,
        officialMode,
      });
      await persist(patch, "?? l?u th?ng tin gi?i (kh?ng g?m lu?t N?i dung).");
      return;
    }
    const patch = buildIdentityPatch({
      name,
      hostClubName,
      officialMode: official ? officialMode : undefined,
    });
    await persist(patch, "?? l?u th?ng tin gi?i.");
  };

  const handleAddEvent = async () => {
    if (!official) return;
    const built = buildAddOfficialEventPatch(tournament, {
      eventType: addEventType,
      name: addEventName,
      registrationMode: addRegistrationMode,
    });
    if (!built.ok) {
      setMessage({ type: "error", text: built.error || "Kh?ng th?m ???c n?i dung." });
      return;
    }
    if (await persist(built.patch, "?? th?m n?i dung.")) {
      const next = new URLSearchParams(searchParams);
      next.set("eventId", built.event.id);
      setSearchParams(next);
      setScope("event");
      setAddEventName("");
      setEventName(built.event.name || "");
      setEventType(built.event.eventType || addEventType);
    }
  };

  const handleSaveEvent = async () => {
    if (!selectedEvent) {
      setMessage({ type: "error", text: "H?y ch?n n?i dung tr??c khi l?u." });
      return;
    }
    const result = buildUpdateEventPatch(tournament, selectedEvent.id, {
      name: eventName,
      eventType,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    // Format / competition rules always Content-owned when Official + event selected.
    if (official && (tab === "format" || tab === "info")) {
      if (tab === "format") {
        const draft = buildOfficialDraftPayload();
        const settingsBuilt =
          officialAdapter?.commands?.saveSettings?.(tournament, draft) ||
          buildOfficialSettingsSavePatch(tournament, draft);
        if (!settingsBuilt.ok) {
          setMessage({ type: "error", text: settingsBuilt.error || "Kh?ng l?u ???c th? th?c." });
          return;
        }
        await persist(
          {
            ...result.patch,
            events: settingsBuilt.patch.events,
            settings: settingsBuilt.patch.settings,
          },
          "?? l?u N?i dung + lu?t Content-owned (event.competitionRules)."
        );
        return;
      }
    }
    await persist(result.patch, "?? l?u n?i dung ?ang ch?n.");
  };

  const handlePrimarySave = () => {
    if (scope === "event") return handleSaveEvent();
    return handleSaveIdentity();
  };

  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };

  const headerActions = (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
        T?ng quan
      </Button>
      {competitionLocked && scope === "event" ? (
        <Button variant="outlined" size="small" disabled sx={outlinedActionSx}>
          Xem c?u h?nh
        </Button>
      ) : (
        <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SaveOutlinedIcon />}
            disabled={busy}
            onClick={handlePrimarySave}
            sx={outlinedActionSx}
          >
            L?u nh?p
          </Button>
        </PermissionGate>
      )}
      <Button
        variant="outlined"
        size="small"
        startIcon={<VisibilityOutlinedIcon />}
        component={RouterLink}
        to={individualPublicTournamentPath(tournamentId)}
        sx={outlinedActionSx}
      >
        Xem tr??c
      </Button>
      <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
        <Button variant="contained" size="small" disabled={busy} onClick={handlePrimarySave} sx={primaryActionSx}>
          {competitionLocked && scope === "event" ? "C?p nh?t th?ng tin" : "C?p nh?t"}
        </Button>
      </PermissionGate>
    </Stack>
  );

  if (loading) {
    return (
      <SettingsShell>
        <Alert severity="info">?ang t?i c?i ??t gi?i?</Alert>
      </SettingsShell>
    );
  }
  if (error) {
    return (
      <SettingsShell>
        <Alert severity="error">{error}</Alert>
      </SettingsShell>
    );
  }
  if (!tournament) {
    return (
      <SettingsShell>
        <ClubAssignmentBanner />
        <Alert severity="warning">Kh?ng t?m th?y gi?i. Ch?n CLB tr?n thanh c?ng c? r?i m? l?i gi?i.</Alert>
      </SettingsShell>
    );
  }
  if (!isIndividualTournament(tournament)) {
    return (
      <SettingsShell>
        <Alert severity="info">
          C?i ??t n?y d?nh cho gi?i c? nh?n / ch?nh th?c.{" "}
          <Button component={RouterLink} to="/tournament" size="small">
            Quay l?i
          </Button>
        </Alert>
      </SettingsShell>
    );
  }

  const scheduleDate = tournament.courtSchedule?.date || "";
  const typeLabel = modeLabelVi(tournament.mode);
  const eventMeta = selectedEvent
    ? `${EVENT_TYPE_LABELS[selectedEvent.eventType] || "N?i dung"} ? ${Array.isArray(selectedEvent.entries) ? selectedEvent.entries.length : 0} c?p ? ${statusLabelVi(selectedEvent.status) || "Ch?a c?u h?nh"}`
    : "Ch?a ch?n n?i dung ?? c?u h?nh";

  return (
    <SettingsShell
      contextLine={scope === "event" ? selectedEvent?.name : null}
      actions={headerActions}
    >
      <ClubAssignmentBanner />
      {message ? (
        <Alert severity={message.type} sx={{ mb: 1.25 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Ph?m vi c?u h?nh">
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mb: 0.75 }}>
                Gi?i ??u v? N?i dung l? hai ph?m vi ri?ng.
              </Typography>
              <Stack spacing={0.6}>
                <Typography sx={{ fontSize: 12.5 }}>
                  <strong>Gi?i ??u</strong> = {tournament.name}
                </Typography>
                <Typography sx={{ fontSize: 12.5 }}>
                  <strong>N?i dung</strong> = {scope === "event" ? selectedEvent?.name || "Ch?a ch?n ?? c?u h?nh" : "Ch?a ch?n ?? c?u h?nh"}
                </Typography>
              </Stack>
            </CenterRightRailCard>
            {competitionLocked && scope === "event" ? (
              <CenterRightRailCard title="Tr?ng th?i c?u h?nh">
                <ExperienceStatusChip tone="success" label="?? KH?A" />
                <Typography sx={{ fontSize: 12.5, mt: 0.75, fontWeight: 700 }}>
                  N?i dung ?? b?t ??u thi ??u
                </Typography>
                <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
                  C?c c?u h?nh ?nh h??ng thi ??u ?? kh?a. Ch? th?ng tin t?n / h?ng m?c c?n l?u ???c.
                </Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                  Thay ??i th? th?c sau khi n?i dung ?? b?t ??u c?n quy tr?nh ?i?u ch?nh ri?ng ? ch?a c? tr?n m?n n?y.
                </Typography>
              </CenterRightRailCard>
            ) : (
              <CenterRightRailCard title="M?c s?n s?ng">
                <ExperienceStatusChip
                  tone={tournament.status === "draft" ? "info" : "success"}
                  label={statusLabelVi(tournament.status) || "B?N NH?P"}
                />
                <Typography sx={{ fontSize: 12.5, mt: 0.75 }}>
                  L?u ch? c?p nh?t h? s? gi?i. Kh?ng kh?a ??ng k?, kh?ng c?ng b?, kh?ng ho?n t?t.
                </Typography>
              </CenterRightRailCard>
            )}
            <CenterRightRailCard title="T?c ??ng">
              <Typography sx={{ fontSize: 12.5 }}>
                {competitionLocked && scope === "event"
                  ? "C?u h?nh thi ??u ?? kh?a. Ch? th?ng tin kh?ng ??i th? th?c c? th? c?p nh?t."
                  : "L?u nh?p kh?ng c?ng b? c?ng khai, kh?ng kh?a ??ng k?, kh?ng kh?a b?c th?m."}
              </Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="L?u g?n nh?t">
              <Typography sx={{ fontSize: 12.5 }}>
                {tournament.updatedAt
                  ? new Date(tournament.updatedAt).toLocaleString("vi-VN")
                  : "Ch?a c? l?n l?u tr?n h? s?"}
              </Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>
                {busy ? "?ang l?u?" : "Ch?a C?p nh?t ch?nh th?c"}
              </Typography>
            </CenterRightRailCard>
          </>
        }
      >
        <ExperienceChipRow
          value={scope}
          onChange={(next) => {
            setScope(next);
            if (next === "event") {
              const only = resolveSelectedEvent(events, selectedEventId);
              if (only?.id) selectEvent(only.id);
            }
          }}
          items={[
            { id: "tournament", label: "Gi?i ??u" },
            { id: "event", label: "N?i dung" },
          ]}
        />
        {scope === "event" ? (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Ch?n n?i dung</Typography>
            {internal ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                {MULTI_CONTENT_LIMITATION_INTERNAL}
              </Alert>
            ) : null}
            {events.length === 0 ? (
              <Stack spacing={1.25} sx={{ mb: 1.5 }} data-testid="official-empty-event-state">
                <Alert severity="info">
                  Ch?a c? n?i dung thi ??u.
                  <br />
                  T?o n?i dung ??u ti?n ?? c?u h?nh ??ng k? v? th? th?c.
                </Alert>
                {official ? (
                  <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                    <Stack spacing={1.25} data-testid="official-add-event-form">
                      <TextField
                        size="small"
                        fullWidth
                        label="T?n n?i dung"
                        value={addEventName}
                        onChange={(event) => setAddEventName(event.target.value)}
                        placeholder="VD: ??i nam"
                      />
                      <TextField
                        size="small"
                        fullWidth
                        select
                        label="Lo?i n?i dung"
                        value={addEventType}
                        onChange={(event) => {
                          setAddEventType(event.target.value);
                          if (!addEventName.trim()) {
                            setAddEventName(EVENT_TYPE_LABELS[event.target.value] || "");
                          }
                        }}
                      >
                        {EVENT_TYPE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        fullWidth
                        select
                        label="Ch? ?? ??ng k?"
                        value={addRegistrationMode}
                        onChange={(event) => setAddRegistrationMode(event.target.value)}
                        disabled={officialMode === OFFICIAL_MODE.AI_BALANCE}
                        helperText={
                          officialMode === OFFICIAL_MODE.AI_BALANCE
                            ? "AI Balance: ch? ??ng k? c? nh?n."
                            : undefined
                        }
                      >
                        <MenuItem value={OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}>C? nh?n</MenuItem>
                        <MenuItem
                          value={OFFICIAL_REGISTRATION_MODE.PAIR}
                          disabled={officialMode === OFFICIAL_MODE.AI_BALANCE}
                        >
                          C?p c? ??nh
                        </MenuItem>
                      </TextField>
                      <Button
                        variant="contained"
                        disabled={busy}
                        onClick={handleAddEvent}
                        sx={primaryActionSx}
                        data-testid="official-add-event-cta"
                      >
                        + Th?m n?i dung
                      </Button>
                    </Stack>
                  </PermissionGate>
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                    Ch?a c? n?i dung tr?n h? s?.
                  </Typography>
                )}
              </Stack>
            ) : (
              <ExperienceChipRow
                value={selectedEvent?.id || ""}
                onChange={selectEvent}
                items={events.map((item) => ({
                  id: item.id,
                  label: item.name || EVENT_TYPE_LABELS[item.eventType] || "N?i dung",
                }))}
              />
            )}
          </>
        ) : null}

        <ExperienceOperatorCard sx={{ mb: 1.5, bgcolor: TOURNAMENT_COLOR.primarySurface, borderColor: TOURNAMENT_COLOR.primary }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary, letterSpacing: 0.4 }}>
            {scope === "tournament" ? "PH?M VI GI?I ??U" : "N?I DUNG THI ??U"}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
            {scope === "tournament" ? tournament.name : selectedEvent?.name || "Ch?a ch?n n?i dung"}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
            {scope === "tournament"
              ? `${typeLabel} ? ${hostClubName || "Ch?a c? ??a ?i?m"} ? ${scheduleDate || "Ch?a c?u h?nh ng?y"}`
              : eventMeta}
          </Typography>
        </ExperienceOperatorCard>

        <Tabs
          value={tab}
          onChange={(_e, value) => setSettingsTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1.5, minHeight: 36, "& .MuiTab-root": { textTransform: "none", minHeight: 36 } }}
        >
          {TABS.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </Tabs>

        {tab === "info" && scope === "tournament" ? (
          <Stack spacing={1.25}>
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="T?n gi?i ??u"
                  value={name}
                  onChange={(event) => {
                    setDirty(true);
                    setName(event.target.value);
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField size="small" fullWidth label="Lo?i gi?i" value={typeLabel} disabled />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="C?m s?n / ??a ?i?m"
                  value={hostClubName}
                  onChange={(event) => {
                    setDirty(true);
                    setHostClubName(event.target.value);
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField size="small" fullWidth label="Hi?n th? c?ng khai" value="Ch?a c?u h?nh c?ng b?" disabled />
              </Grid>
              {official ? (
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Ch? ?? gi?i"
                    value={officialMode}
                    onChange={(event) => {
                      setDirty(true);
                      setOfficialMode(event.target.value);
                    }}
                  >
                    {Object.entries(OFFICIAL_MODE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField size="small" fullWidth label="Ng?y thi ??u tr?n h? s?" value={scheduleDate || "Ch?a c?u h?nh"} disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="C?p nh?t g?n nh?t"
                  value={tournament.updatedAt ? new Date(tournament.updatedAt).toLocaleString("vi-VN") : "?"}
                  disabled
                />
              </Grid>
            </Grid>
            <Box
              sx={{
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                overflow: "hidden",
                border: `1px solid ${TOURNAMENT_COLOR.divider}`,
              }}
            >
              <CenterIdentitySurface
                height={112}
                gradient={`linear-gradient(120deg, ${TOURNAMENT_COLOR.navy} 0%, #16325C 42%, ${TOURNAMENT_COLOR.primary} 100%)`}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography sx={{ fontSize: 11, opacity: 0.75 }}>?nh / banner ??i di?n</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{name || tournament.name}</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                    {hostClubName || "Ch?a c? ??a ?i?m tr?n h? s?"}
                  </Typography>
                </Box>
              </CenterIdentitySurface>
            </Box>
          </Stack>
        ) : null}

        {tab === "info" && scope === "event" ? (
          selectedEvent ? (
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField size="small" fullWidth label="T?n n?i dung" value={eventName} onChange={(event) => setEventName(event.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Tr?ng th?i n?i dung"
                  value={statusLabelVi(selectedEvent.status) || "Ch?a c?u h?nh"}
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="H?ng m?c"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                  disabled={competitionLocked}
                >
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="S?c ch?a c?p / ??i"
                  value={String(Array.isArray(selectedEvent.entries) ? selectedEvent.entries.length : 0)}
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Th? th?c thi ??u"
                  value={
                    official
                      ? buildContentRulesSummaryLines(contentRulesDraft).join(" ? ")
                      : selectedEvent.groups?.length && selectedEvent.bracket
                        ? "V?ng b?ng + Lo?i tr?c ti?p"
                        : selectedEvent.bracket
                          ? "Lo?i tr?c ti?p"
                          : selectedEvent.groups?.length
                            ? "V?ng b?ng"
                            : "Ch?a c?u h?nh"
                  }
                  disabled
                  multiline={Boolean(official)}
                  minRows={official ? 2 : 1}
                  helperText={
                    official
                      ? "T?m t?t t? Content rules (ch? hi?n th? ? kh?ng ph?i SSOT th? hai)."
                      : undefined
                  }
                />
              </Grid>
              {competitionLocked ? (
                <Grid size={{ xs: 12 }}>
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>
                    Th? th?c v? s?c ch?a ?? kh?a v? n?i dung ?? c? tr?n.
                  </Typography>
                </Grid>
              ) : null}
              {official ? (
                <Grid size={{ xs: 12 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField
                      size="small"
                      select
                      label="Th?m lo?i n?i dung"
                      value={addEventType}
                      onChange={(event) => setAddEventType(event.target.value)}
                      sx={{ minWidth: 220 }}
                    >
                      {EVENT_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                      <Button variant="outlined" disabled={busy} onClick={handleAddEvent} sx={outlinedActionSx}>
                        Th?m n?i dung
                      </Button>
                    </PermissionGate>
                  </Stack>
                </Grid>
              ) : null}
            </Grid>
          ) : (
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
              H?y ch?n n?i dung ?? xem v? l?u th?ng tin.
            </Typography>
          )
        ) : null}

        {tab === "format" ? (
          official ? (
            selectedEvent ? (
              <Stack spacing={1.25} data-testid="official-competition-settings">
                <Alert severity="info">
                  ?ang c?u h?nh N?i dung: {selectedEvent.name || selectedEvent.id}. Lu?t luu tr?n
                  event.competitionRules (Content-owned). Kh?ng k? th?a lu?t Tournament.
                </Alert>
                {rulesBootstrapSource ? (
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    Ngu?n form: {rulesBootstrapSource}
                    {rulesAdoption?.contentRulesSource
                      ? ` ? ${rulesAdoption.contentRulesSource}`
                      : ""}
                    {dirty ? " ? ?ang ch?nh nh?p ? kh?ng ghi d? t? refresh n?n." : ""}
                  </Typography>
                ) : null}
                <OfficialContentFormatSettingsPanel
                  draft={contentRulesDraft}
                  setDraft={setContentDraft}
                  eventName={eventName}
                  eventType={eventType}
                  onEventNameChange={(value) => {
                    setDirty(true);
                    setEventName(value);
                  }}
                  onEventTypeChange={(value) => {
                    setDirty(true);
                    setEventType(value);
                  }}
                  locked={competitionLocked}
                  lockReason="C?c c?u h?nh ?nh hu?ng thi d?u d? kh?a v? n?i dung d? c? tr?n."
                  scoringCaps={scoringCaps}
                  officialMode={officialMode}
                />
              </Stack>
            ) : (
              <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
                Th? th?c thu?c ph?m vi N?i dung. Ch?n N?i dung d? xem thi?t k? th? th?c.
              </Typography>
            )
          ) : scope === "event" ? (
            <FormatDesigner
              steps={formatSteps}
              locked={competitionLocked}
              emptyText="Chua c?u h?nh th? th?c tr?n h? so n?i dung n?y."
            />
          ) : (
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
              Th? th?c thu?c ph?m vi N?i dung. Ch?n N?i dung d? xem thi?t k? th? th?c.
            </Typography>
          )
        ) : null}

        {tab === "rules" ? (
          <Box>
            {competitionLocked && scope === "event" ? (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 1 }}>
                Quy ??nh thi ??u ?? kh?a v? n?i dung ?ang c? tr?n.
              </Typography>
            ) : null}
            <Grid container spacing={1.25}>
              {CONFIG_CARDS.map((rule) => (
                <Grid key={rule.title} size={{ xs: 12, md: 6 }}>
                  <ExperienceOperatorCard>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{rule.title}</Typography>
                      {competitionLocked && scope === "event" ? (
                        <ExperienceStatusChip tone="success" label="?? KH?A" />
                      ) : null}
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.4 }}>{rule.detail}</Typography>
                    <Button
                      component={RouterLink}
                      to={configPath(rule.path, tournament.id)}
                      size="small"
                      sx={{ mt: 0.75, ...outlinedActionSx }}
                    >
                      M? quy ??nh
                    </Button>
                  </ExperienceOperatorCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : null}

        {tab === "fees" ? (
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ExperienceOperatorCard>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>L? ph?</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Ch?a c?u h?nh</Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Kh?ng c? l? ph? tr?n h? s? gi?i n?y.</Typography>
                <Button
                  component={RouterLink}
                  to={configPath("/tournament/config/fee", tournament.id)}
                  size="small"
                  sx={{ mt: 0.75, ...outlinedActionSx }}
                >
                  M? l? ph?
                </Button>
              </ExperienceOperatorCard>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ExperienceOperatorCard>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Gi?i th??ng</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Ch?a c?u h?nh</Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                  C?ng b? gi?i th??ng kh?ng c? tr?n m?n n?y.
                </Typography>
              </ExperienceOperatorCard>
            </Grid>
          </Grid>
        ) : null}

        {tab === "schedule" ? (
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ExperienceOperatorCard>
                <Typography sx={{ fontWeight: 800, mb: 0.75 }}>Ng?y tr?n h? s? s?n</Typography>
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                  {scheduleDate || "Ch?a c?u h?nh ng?y thi ??u"}
                </Typography>
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                  Kh?ng ph?i m?n L?ch thi ??u & Ph?n s?n.
                </Typography>
              </ExperienceOperatorCard>
            </Grid>
          </Grid>
        ) : null}
      </TournamentExperienceWorkspace>
    </SettingsShell>
  );
}
