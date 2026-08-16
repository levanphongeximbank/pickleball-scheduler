import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  parseOfficialDecimalLevelInput,
  normalizeOfficialTournamentName,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_SCORING_METHOD_LABELS,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_MATCH_FORMAT_LABELS,
  OFFICIAL_MATCH_FORMAT_HELPERS,
  OFFICIAL_ROUND_SCORE_KEY,
  OFFICIAL_ROUND_SCORE_LABELS,
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  BEST_OF_3_OPERATIONAL,
  BEST_OF_3_SELECTION_FAIL_CLOSED,
  BEST_OF_3_SHARED_CAPABILITY_GAP,
  WIN_BY_POLICY_DEFERRED,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import { allowedOfficialRegistrationModes } from "../../../features/individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  getEligibilityRules,
  patchOfficialVisibleEligibilityLimits,
} from "../../../features/individual-tournament/engines/eligibilityEngine.js";

const fieldLabelProps = { shrink: true };

/**
 * Tournament Settings screen — configuration only (no match-day ops).
 * Eligibility binds to settings.eligibilityRules (eligibilityEngine).
 * Group count uses the single Setup ↔ officialCompetition.groupCount path.
 * Tournament name uses canonical tournament.name (no second displayName).
 */
export default function OfficialTournamentSettingsScreen({
  tournament,
  officialMode,
  onOfficialModeChange,
  groupCount,
  onGroupCountChange,
  canManage = true,
  onPersistSettings,
}) {
  const current = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const eligibility = useMemo(() => getEligibilityRules(tournament), [tournament]);
  const [draft, setDraft] = useState(() => ({
    tournamentName: tournament?.name || "",
    registrationMode: current.registrationMode || "",
    scoringMethod: current.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY,
    matchFormat: current.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1,
    roundTargets: { ...current.roundTargets },
    qualifiersPerGroup: current.qualifiersPerGroup || 2,
    maxSkillLevel:
      eligibility.skill?.maxLevel != null ? String(eligibility.skill.maxLevel) : "",
    maxRating:
      eligibility.rating?.maxRating != null ? String(eligibility.rating.maxRating) : "",
  }));
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = getOfficialCompetitionSettings(tournament);
    const nextEligibility = getEligibilityRules(tournament);
    setDraft({
      tournamentName: tournament?.name || "",
      registrationMode: next.registrationMode || "",
      scoringMethod: next.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY,
      matchFormat: next.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1,
      roundTargets: { ...next.roundTargets },
      qualifiersPerGroup: next.qualifiersPerGroup || 2,
      maxSkillLevel:
        nextEligibility.skill?.maxLevel != null
          ? String(nextEligibility.skill.maxLevel)
          : "",
      maxRating:
        nextEligibility.rating?.maxRating != null
          ? String(nextEligibility.rating.maxRating)
          : "",
    });
  }, [tournament]);

  const handleSave = async () => {
    if (!canManage) return;
    const nameResult = normalizeOfficialTournamentName(draft.tournamentName);
    if (!nameResult.ok) {
      setMessage({ type: "error", text: nameResult.error });
      return;
    }

    const aiBalance = officialMode === OFFICIAL_MODE.AI_BALANCE;
    const allowedModes = allowedOfficialRegistrationModes(officialMode);
    const registrationMode = aiBalance
      ? OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
      : draft.registrationMode;
    if (!allowedModes.includes(registrationMode)) {
      setMessage({
        type: "error",
        text: aiBalance
          ? "AI Balance chỉ nhận đăng ký cá nhân."
          : "Phải chọn rõ chế độ đăng ký: Cá nhân hoặc Theo cặp.",
      });
      return;
    }

    const skillParsed = parseOfficialDecimalLevelInput(draft.maxSkillLevel);
    if (!skillParsed.ok) {
      setMessage({ type: "error", text: `Trần trình độ: ${skillParsed.error}` });
      return;
    }
    const ratingParsed = parseOfficialDecimalLevelInput(draft.maxRating);
    if (!ratingParsed.ok) {
      setMessage({ type: "error", text: `Trần rating: ${ratingParsed.error}` });
      return;
    }

    const selectedMethod = String(draft.scoringMethod || "").trim().toLowerCase();
    if (
      selectedMethod === OFFICIAL_SCORING_METHOD.SIDE_OUT &&
      (!SIDEOUT_OPERATIONAL || SIDEOUT_SELECTION_FAIL_CLOSED)
    ) {
      setMessage({
        type: "error",
        text: "Truyền thống (Side-out) chưa sẵn sàng trên môi trường hiện tại. Chọn Rally để lưu.",
      });
      return;
    }

    const selectedFormat = String(draft.matchFormat || "")
      .trim()
      .toUpperCase()
      .replace(/-/g, "_");
    if (
      selectedFormat === OFFICIAL_MATCH_FORMAT.BEST_OF_3 &&
      (!BEST_OF_3_OPERATIONAL || BEST_OF_3_SELECTION_FAIL_CLOSED)
    ) {
      setMessage({
        type: "error",
        text: "Best of 3 chưa sẵn sàng trên đường Official classic hiện tại. Chọn Best of 1 để lưu.",
      });
      return;
    }

    setSaving(true);
    try {
      let next = patchOfficialCompetitionSettings(tournament, {
        registrationMode,
        scoringMethod: selectedMethod,
        matchFormat: selectedFormat,
        roundTargets: draft.roundTargets,
        groupCount,
        qualifiersPerGroup: Number(draft.qualifiersPerGroup) || 2,
      });
      next = { ...next, name: nameResult.name };

      const eligibilityPatch = patchOfficialVisibleEligibilityLimits(next, {
        maxLevel: skillParsed.value,
        maxRating: ratingParsed.value,
      });
      next = eligibilityPatch.tournament;

      const saved = await onPersistSettings?.(next);
      if (!saved) {
        setMessage({ type: "error", text: "Không lưu được cài đặt." });
        return;
      }
      setMessage({ type: "success", text: "Đã lưu cài đặt giải." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Không lưu được cài đặt." });
    } finally {
      setSaving(false);
    }
  };

  const scoringValue =
    draft.scoringMethod === OFFICIAL_SCORING_METHOD.SIDE_OUT && SIDEOUT_OPERATIONAL
      ? OFFICIAL_SCORING_METHOD.SIDE_OUT
      : OFFICIAL_SCORING_METHOD.RALLY;

  const matchFormatValue =
    draft.matchFormat === OFFICIAL_MATCH_FORMAT.BEST_OF_3 && BEST_OF_3_OPERATIONAL
      ? OFFICIAL_MATCH_FORMAT.BEST_OF_3
      : OFFICIAL_MATCH_FORMAT.BEST_OF_1;

  return (
    <Stack spacing={2.5}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      {current.registrationModeUnresolved ? (
        <Alert severity="warning">
          Giải cũ chưa xác định chế độ đăng ký. Chọn <strong>Đăng ký cá nhân</strong> hoặc{" "}
          <strong>Đăng ký theo cặp</strong> rồi Lưu trước khi đăng ký mới / bốc thăm.
        </Alert>
      ) : current.registrationModeSource === "legacy_derived" ? (
        <Alert severity="info">
          Chế độ đăng ký được suy ra từ dữ liệu giải cũ (
          {OFFICIAL_REGISTRATION_MODE_LABELS[current.registrationMode]}). Chọn rõ và Lưu để khóa
          cấu hình.
        </Alert>
      ) : null}

      <Typography variant="subtitle1" fontWeight={700}>
        Thông tin giải
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="Tên giải"
            value={draft.tournamentName}
            disabled={!canManage}
            InputLabelProps={fieldLabelProps}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, tournamentName: e.target.value }))
            }
            helperText="Tên hiển thị trên danh sách giải, trang BTC và kết quả công khai."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="official-settings-mode-label" shrink>
              Chiến lược ghép/bốc
            </InputLabel>
            <Select
              labelId="official-settings-mode-label"
              id="official-settings-mode"
              label="Chiến lược ghép/bốc"
              notched
              value={officialMode}
              disabled={!canManage}
              onChange={(e) => onOfficialModeChange?.(e.target.value)}
            >
              <MenuItem value={OFFICIAL_MODE.OPEN}>Open (ghép cặp / chia bảng ngẫu nhiên)</MenuItem>
              <MenuItem value={OFFICIAL_MODE.AI_BALANCE}>AI Balance (ghép cặp AI, chia bảng ngẫu nhiên)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small" required>
            <InputLabel id="official-settings-reg-mode-label" shrink>
              Chế độ đăng ký
            </InputLabel>
            <Select
              labelId="official-settings-reg-mode-label"
              id="official-settings-reg-mode"
              label="Chế độ đăng ký"
              notched
              value={
                officialMode === OFFICIAL_MODE.AI_BALANCE
                  ? OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
                  : draft.registrationMode || ""
              }
              displayEmpty
              disabled={!canManage || officialMode === OFFICIAL_MODE.AI_BALANCE}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, registrationMode: e.target.value }))
              }
            >
              {officialMode === OFFICIAL_MODE.AI_BALANCE ? null : (
                <MenuItem value="" disabled>
                  — Chọn chế độ —
                </MenuItem>
              )}
              <MenuItem value={OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}>
                {OFFICIAL_REGISTRATION_MODE_LABELS[OFFICIAL_REGISTRATION_MODE.INDIVIDUAL]}
              </MenuItem>
              {officialMode === OFFICIAL_MODE.OPEN ? (
                <MenuItem value={OFFICIAL_REGISTRATION_MODE.PAIR}>
                  {OFFICIAL_REGISTRATION_MODE_LABELS[OFFICIAL_REGISTRATION_MODE.PAIR]}
                </MenuItem>
              ) : null}
            </Select>
            <FormHelperText>
              {officialMode === OFFICIAL_MODE.AI_BALANCE
                ? "AI Balance chỉ đăng ký cá nhân. Ghép cặp do hệ thống AI — không đăng ký theo cặp."
                : "Open: cá nhân (ghép cặp ngẫu nhiên) hoặc theo cặp (không ghép lại)."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Số bảng"
            value={groupCount}
            disabled={!canManage}
            InputLabelProps={fieldLabelProps}
            inputProps={{ min: 1, max: 16 }}
            onChange={(e) => onGroupCountChange?.(Number(e.target.value) || 1)}
            helperText="Cấu hình số bảng dùng khi bốc thăm (một nguồn)."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Suất vào knockout mỗi bảng"
            value={draft.qualifiersPerGroup ?? 2}
            disabled={!canManage}
            InputLabelProps={fieldLabelProps}
            inputProps={{ min: 1, max: 8 }}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                qualifiersPerGroup: Number(e.target.value) || 2,
              }))
            }
            helperText="Mặc định 2. Không dùng best runners-up. Hòa chỉ số thể thao tại ranh giới → không tạo KO."
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight={700}>
        Điều kiện trình độ / rating
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="Trần trình độ"
            value={draft.maxSkillLevel}
            disabled={!canManage}
            InputLabelProps={fieldLabelProps}
            placeholder="VD: 4.5 hoặc 4,4"
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, maxSkillLevel: e.target.value }))
            }
            helperText="Để trống nếu không giới hạn. Thập phân: 4.5 hoặc 4,5."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="Trần rating"
            value={draft.maxRating}
            disabled={!canManage}
            InputLabelProps={fieldLabelProps}
            placeholder="VD: 4.5 hoặc 4,4"
            onChange={(e) => setDraft((prev) => ({ ...prev, maxRating: e.target.value }))}
            helperText="Để trống nếu không giới hạn. Thập phân: 4.5 hoặc 4,5."
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight={700}>
        Luật trận đấu
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="official-settings-scoring-label" shrink>
              Cách tính điểm
            </InputLabel>
            <Select
              labelId="official-settings-scoring-label"
              id="official-settings-scoring"
              label="Cách tính điểm"
              notched
              value={scoringValue}
              disabled={!canManage}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, scoringMethod: e.target.value }))
              }
            >
              <MenuItem value={OFFICIAL_SCORING_METHOD.RALLY}>
                {OFFICIAL_SCORING_METHOD_LABELS[OFFICIAL_SCORING_METHOD.RALLY]}
              </MenuItem>
              <MenuItem
                value={OFFICIAL_SCORING_METHOD.SIDE_OUT}
                disabled={!SIDEOUT_OPERATIONAL}
              >
                {OFFICIAL_SCORING_METHOD_LABELS[OFFICIAL_SCORING_METHOD.SIDE_OUT]}
                {!SIDEOUT_OPERATIONAL ? " — chưa sẵn sàng" : ""}
              </MenuItem>
            </Select>
            <FormHelperText>
              {!SIDEOUT_OPERATIONAL
                ? "Rally: mỗi rally ghi 1 điểm. Truyền thống (Side-out) chưa vận hành trên live Official."
                : "Rally: mỗi rally ghi 1 điểm. Side-out: chỉ bên giao bóng ghi điểm."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="official-settings-match-format-label" shrink>
              Thể thức trận đấu
            </InputLabel>
            <Select
              labelId="official-settings-match-format-label"
              id="official-settings-match-format"
              label="Thể thức trận đấu"
              notched
              value={matchFormatValue}
              disabled={!canManage}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, matchFormat: e.target.value }))
              }
            >
              <MenuItem value={OFFICIAL_MATCH_FORMAT.BEST_OF_1}>
                {OFFICIAL_MATCH_FORMAT_LABELS[OFFICIAL_MATCH_FORMAT.BEST_OF_1]}
              </MenuItem>
              <MenuItem
                value={OFFICIAL_MATCH_FORMAT.BEST_OF_3}
                disabled={!BEST_OF_3_OPERATIONAL}
              >
                {OFFICIAL_MATCH_FORMAT_LABELS[OFFICIAL_MATCH_FORMAT.BEST_OF_3]}
                {!BEST_OF_3_OPERATIONAL ? " — chưa sẵn sàng" : ""}
              </MenuItem>
            </Select>
            <FormHelperText>
              {OFFICIAL_MATCH_FORMAT_HELPERS[matchFormatValue]}
              {!BEST_OF_3_OPERATIONAL
                ? " Best of 3 cần multi-game Official live/result — chưa bật."
                : ""}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
      {!SIDEOUT_OPERATIONAL ? (
        <Alert severity="info">
          Side-out cần trạng thái giao bóng trên live match (gói SQL riêng). Không lưu được Side-out
          như chế độ vận hành cho đến khi gói đó được Owner duyệt/apply.
        </Alert>
      ) : null}
      {!BEST_OF_3_OPERATIONAL ? (
        <Alert severity="info">{BEST_OF_3_SHARED_CAPABILITY_GAP}</Alert>
      ) : null}
      {WIN_BY_POLICY_DEFERRED ? (
        <Alert severity="info">
          Win-by (cách biệt điểm) đang deferred — Official classic không hardcode winBy=2.
        </Alert>
      ) : null}

      <Typography variant="subtitle1" fontWeight={700}>
        Điểm kết thúc ván (theo vòng)
      </Typography>
      <Grid container spacing={2}>
        {Object.values(OFFICIAL_ROUND_SCORE_KEY).map((key) => (
          <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label={OFFICIAL_ROUND_SCORE_LABELS[key]}
              value={draft.roundTargets[key]}
              disabled={!canManage}
              InputLabelProps={fieldLabelProps}
              inputProps={{ min: 1, max: 99 }}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  roundTargets: {
                    ...prev.roundTargets,
                    [key]: Number(e.target.value) || prev.roundTargets[key],
                  },
                }))
              }
              helperText="Độc lập với thể thức Best of."
            />
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!canManage || saving} onClick={handleSave}>
          {saving ? "Đang lưu…" : "Lưu cài đặt"}
        </Button>
      </Stack>
    </Stack>
  );
}
