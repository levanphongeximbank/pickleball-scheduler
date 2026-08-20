import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import RefereeRosterPanel from "../RefereeRosterPanel.jsx";
import RefereeAssignPanel from "../RefereeAssignPanel.jsx";
import {
  REFEREE_IDENTITY_BINDING_BLOCKED,
  syncOfficialRefereeAssignResultToLive,
} from "../../../features/individual-tournament/engines/officialRefereeLiveBridge.js";
import { summarizeOfficialRefereeOps } from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  annotateRosterEligibility,
  listEligibleCanonicalReferees,
} from "../../../features/daily-play/services/refereeDirectoryService.js";

/**
 * Official-owned referee ops: roster + assign + live bridge.
 * Canonical account candidates and manual/external referees remain explicit.
 */
export default function OfficialTournamentRefereeOps({
  tournament,
  eventId = "",
  roster = [],
  onRosterChange,
  actor = null,
  clubId,
  courts = [],
  players = [],
  canManage = true,
  onPersistTournament,
  tournamentId,
  matchPresentationById = null,
}) {
  const [bridgeMessage, setBridgeMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [canonicalReferees, setCanonicalReferees] = useState([]);
  const [canonicalLoading, setCanonicalLoading] = useState(false);
  const [canonicalError, setCanonicalError] = useState(null);
  const [canonicalWarning, setCanonicalWarning] = useState(null);
  const summary = useMemo(
    () => summarizeOfficialRefereeOps(tournament, eventId),
    [tournament, eventId]
  );
  const tenantId = tournament?.tenantId || "";
  const projectedRoster = useMemo(
    () => annotateRosterEligibility(roster, canonicalReferees),
    [roster, canonicalReferees]
  );

  useEffect(() => {
    let cancelled = false;
    if (!tenantId || !canManage) {
      setCanonicalReferees([]);
      setCanonicalError(null);
      setCanonicalWarning(null);
      return undefined;
    }

    setCanonicalLoading(true);
    setCanonicalError(null);
    void listEligibleCanonicalReferees({
      tenantId,
      clubId,
      actor,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setCanonicalReferees([]);
          setCanonicalError(result.error || "Không tải được danh bạ trọng tài.");
          setCanonicalWarning(null);
          return;
        }
        setCanonicalReferees(result.referees || []);
        setCanonicalWarning(result.warning || null);
      })
      .finally(() => {
        if (!cancelled) setCanonicalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, clubId, actor, canManage]);

  const handleAssignPersist = async (nextTournament, meta = {}) => {
    if (!canManage) return;
    setSaving(true);
    try {
      const saved = await onPersistTournament?.(nextTournament);
      if (!saved) {
        setBridgeMessage({ type: "error", text: "Không lưu được phân công trọng tài." });
        return;
      }

      if (!meta?.assignResult?.ok) {
        setBridgeMessage({ type: "success", text: "Đã cập nhật trọng tài." });
        return;
      }

      const live = await syncOfficialRefereeAssignResultToLive({
        tournament: nextTournament,
        assignResult: { ...meta.assignResult, tournament: nextTournament },
        clubId,
        courts,
        players,
      });

      if (live.needsSupabase) {
        setBridgeMessage({
          type: "warning",
          text:
            live.error ||
            "Đã lưu phân công trên giải; chưa đồng bộ live (thiếu Supabase).",
        });
        return;
      }
      if (!live.ok) {
        setBridgeMessage({
          type: "warning",
          text:
            live.warning ||
            live.error ||
            "Đã phân công nhưng chưa tạo được live scoreboard cho trọng tài.",
        });
        return;
      }
      setBridgeMessage({
        type: "success",
        text: `Đã phân công và đồng bộ live ${live.synced.length} trận.`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Danh sách TT: ${summary.rosterCount}`} />
        <Chip
          size="small"
          color={summary.unassignedCount ? "warning" : "success"}
          label={summary.coverage || "Chưa có trận"}
        />
        {REFEREE_IDENTITY_BINDING_BLOCKED ? (
          <Chip
            size="small"
            variant="outlined"
            label="Định danh TT: name/roster (binding user bị chặn Phase 2A)"
          />
        ) : null}
        {saving ? <Chip size="small" color="info" label="Đang lưu…" /> : null}
      </Stack>

      {bridgeMessage ? (
        <Alert severity={bridgeMessage.type} onClose={() => setBridgeMessage(null)}>
          {bridgeMessage.text}
        </Alert>
      ) : null}

      <Typography variant="subtitle2">1. Danh sách trọng tài</Typography>
      <RefereeRosterPanel
        roster={projectedRoster}
        onChange={onRosterChange}
        enableCanonicalDirectory={canManage}
        canonicalCandidates={canonicalReferees}
        canonicalLoading={canonicalLoading}
        canonicalError={canonicalError}
        canonicalWarning={canonicalWarning}
        description="Chọn tài khoản REFEREE để liên kết canonicalUserId, hoặc thêm trọng tài khách nhập tay không thuộc danh tính tài khoản."
      />

      <Divider />

      <Typography variant="subtitle2">2. Phân công theo trận</Typography>
      {!canManage ? (
        <Alert severity="info">Bạn không có quyền phân công trọng tài.</Alert>
      ) : summary.matchCount === 0 ? (
        <Alert severity="info">Chưa có trận để phân công trọng tài.</Alert>
      ) : (
        <RefereeAssignPanel
          tournament={tournament}
          eventId={eventId}
          actor={actor}
          tenantId={tenantId}
          compact
          onTournamentChange={handleAssignPersist}
          matchPresentationById={matchPresentationById}
        />
      )}

      <Button
        component={RouterLink}
        to={`/tournament/referee-assign?tournamentId=${encodeURIComponent(
          tournamentId || tournament?.id || ""
        )}`}
        variant="outlined"
        size="small"
      >
        Mở trang vận hành trọng tài đầy đủ
      </Button>
    </Stack>
  );
}
