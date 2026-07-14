import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";

import { simulatePrivatePairing } from "../../ui/privatePairingAdminApi.js";
import { MAPPING_STATUS } from "../../../club/repositories/canonicalRepositoryTypes.js";
import PrivatePairingCandidateCard from "./PrivatePairingCandidateCard.jsx";

const SIM_ERROR_MESSAGES = {
  SIMULATION_FEATURE_DISABLED:
    "Tính năng mô phỏng đang tắt (thiếu cờ VITE_PRIVATE_PAIRING_SIMULATION_ENABLED).",
  SIMULATION_RUNTIME_DISABLED: "Runtime mô phỏng đang tắt.",
  SIMULATION_INVALID_INPUT: "Dữ liệu đầu vào không hợp lệ.",
  NEED_MAPPED_PLAYERS:
    "Cần ít nhất 4 vận động viên đã ánh xạ (MAPPED/DERIVED). Hãy chọn CLB nguồn có đủ VĐV.",
  NO_ELIGIBLE_PLAYERS:
    "Không có vận động viên hợp lệ để ghép. Hãy chọn CLB nguồn có VĐV đã ánh xạ.",
  NO_FEASIBLE_PAIRING:
    "Không tìm được phương án ghép cặp khả thi với các quy tắc hiện tại.",
  SEARCH_LIMIT_REACHED:
    "Đã đạt giới hạn tìm kiếm — thử tăng Max candidates hoặc đổi seed.",
  CONSTRAINT_CONFLICT:
    "Các quy tắc đang xung đột (hard rule mâu thuẫn). Kiểm tra tab Xung đột.",
  SIMULATION_FAILED: "Mô phỏng thất bại. Vui lòng thử lại.",
};

function humanizeSimError(code) {
  if (!code) return "";
  return SIM_ERROR_MESSAGES[code] || code;
}

/**
 * PR-4.5 simulation UI — read-only Top N. No Apply-to-live.
 */
export default function PrivatePairingSimulationPanel({
  enabled = false,
  canSimulate = false,
  rules = [],
  playerOptions = [],
  mappingSummary = null,
  pickerWarnings = [],
  sourceClubId = "",
  scopeType = null,
  scopeId = null,
  tenantId = null,
  envSource = null,
  competitionClass = null,
}) {
  const [seed, setSeed] = useState("42");
  const [topN, setTopN] = useState(10);
  const [maxCandidates, setMaxCandidates] = useState(200);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copyNote, setCopyNote] = useState(null);

  const simPlayers = useMemo(
    () =>
      (playerOptions || [])
        .filter((p) => {
          const status = String(p.mappingStatus || MAPPING_STATUS.MAPPED).toUpperCase();
          return status === MAPPING_STATUS.MAPPED || status === MAPPING_STATUS.DERIVED;
        })
        .map((p) => ({
          playerId: p.id || p.playerId,
          displayName: p.name || p.displayName,
          gender: p.gender,
          rating: p.rating ?? p.level ?? null,
          clubId: p.clubId || sourceClubId,
          tenantId: p.tenantId || tenantId,
          mappingStatus: p.mappingStatus || MAPPING_STATUS.MAPPED,
          membershipStatus: p.membershipStatus || "active",
          status: p.status || "active",
        })),
    [playerOptions, sourceClubId, tenantId]
  );

  const handleRun = async () => {
    setError(null);
    setCopyNote(null);
    if (!enabled || !canSimulate) {
      setError("SIMULATION_FEATURE_DISABLED");
      return;
    }
    if (simPlayers.length < 4) {
      setError("NEED_MAPPED_PLAYERS");
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const out = await simulatePrivatePairing({
        players: simPlayers,
        rules: (rules || []).filter((r) => r.active !== false),
        seed: Number(seed) || seed || 1,
        topN: Number(topN) || 10,
        maxCandidates: Number(maxCandidates) || 200,
        maxIterations: Math.max(400, Number(maxCandidates) * 2),
        timeoutMs: 2000,
        teamSize: 2,
        courtCount: Math.max(1, Math.floor(simPlayers.length / 4)),
        options: { matchMode: true },
        scopeType,
        scopeId,
        sourceClubId,
        trustedTenantId: tenantId,
        competitionClass,
        envSource,
      });
      setResult(out);
      if (!out.ok && out.errorCode) {
        setError(out.errorCode);
      }
    } catch (err) {
      setError(err?.message || "SIMULATION_FAILED");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) {
    return (
      <Alert severity="info">
        Flag <code>VITE_PRIVATE_PAIRING_SIMULATION_ENABLED</code> đang tắt — không chạy mô phỏng.
      </Alert>
    );
  }

  if (!canSimulate) {
    return (
      <Alert severity="warning">
        Thiếu quyền <code>pairing.private_rules.simulate</code>.
      </Alert>
    );
  }

  const summary = result?.summary || {};

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <ScienceIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Mô phỏng ghép cặp (Top N)
        </Typography>
        <Chip size="small" color="info" label="Mô phỏng — chưa áp dụng" />
      </Stack>

      <Alert severity="info" sx={{ mb: 1 }}>
        Chỉ đọc — không ghi tournament / match / lineup / draw.
      </Alert>

      {mappingSummary && (
        <Alert severity={pickerWarnings?.length ? "warning" : "info"} sx={{ mb: 1 }}>
          Active: {mappingSummary.activeMembers ?? "—"} · mapped:{" "}
          {mappingSummary.mappedPlayers ?? 0} · derived: {mappingSummary.derivedPlayers ?? 0} ·
          unmapped: {mappingSummary.unmappedMembers ?? 0} · invalid:{" "}
          {mappingSummary.invalidMappings ?? 0} · dedupe: {mappingSummary.duplicatesRemoved ?? 0}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
        <TextField
          size="small"
          label="Seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          inputProps={{ "aria-label": "Seed mô phỏng" }}
        />
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Top N</InputLabel>
          <Select
            label="Top N"
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
          >
            {[3, 5, 10, 20, 50].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="number"
          label="Max candidates"
          value={maxCandidates}
          onChange={(e) => setMaxCandidates(e.target.value)}
          inputProps={{ min: 10, max: 5000, "aria-label": "Max candidates" }}
        />
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={loading}
          aria-label="Chạy mô phỏng"
        >
          {loading ? "Đang chạy…" : "Chạy mô phỏng"}
        </Button>
        <Button variant="outlined" onClick={() => setSeed(String(Date.now() % 100000))} aria-label="Tạo seed mới">
          Seed mới
        </Button>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {humanizeSimError(error)}
          {result?.summary?.searchLimitReached ? " · Đã đạt giới hạn tìm kiếm" : ""}
        </Alert>
      )}
      {copyNote && (
        <Alert severity="success" sx={{ mb: 1 }}>
          {copyNote}
        </Alert>
      )}

      {result && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Chip size="small" label={`Nhận ${summary.playersReceived ?? 0}`} />
            <Chip size="small" label={`Hợp lệ ${summary.playersEligible ?? 0}`} />
            <Chip size="small" label={`Generated ${summary.candidatesGenerated ?? 0}`} />
            <Chip size="small" label={`Rejected ${summary.candidatesRejected ?? 0}`} />
            <Chip size="small" label={`${summary.executionTimeMs ?? 0} ms`} />
            <Chip
              size="small"
              color={summary.feasible ? "success" : "error"}
              label={summary.feasible ? "Feasible" : "Infeasible"}
            />
            {summary.searchLimitReached && (
              <Chip size="small" color="warning" label="searchLimitReached" />
            )}
            <Chip size="small" variant="outlined" label={`seed=${result.seed}`} />
          </Stack>

          {(result.selectedCandidates || []).map((candidate) => (
            <PrivatePairingCandidateCard
              key={candidate.deterministicKey || candidate.candidateId || candidate.rank}
              candidate={candidate}
              onCopyKey={async (key) => {
                try {
                  if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(key);
                    setCopyNote("Đã sao chép mã phương án.");
                  } else {
                    setCopyNote(key);
                  }
                } catch {
                  setCopyNote(key);
                }
              }}
            />
          ))}

          {!result.ok && !(result.selectedCandidates || []).length && (
            <Alert severity="error">Không có phương án khả thi (xem error code ở trên).</Alert>
          )}
        </>
      )}
    </Box>
  );
}
