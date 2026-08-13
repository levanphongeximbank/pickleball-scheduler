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
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_SCORING_METHOD_LABELS,
  OFFICIAL_ROUND_SCORE_KEY,
  OFFICIAL_ROUND_SCORE_LABELS,
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  INTENDED_NEW_TOURNAMENT_SCORING_METHOD,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import {
  getEligibilityRules,
  updateEligibilityRules,
} from "../../../features/individual-tournament/engines/eligibilityEngine.js";

const fieldLabelProps = { shrink: true };

/**
 * Tournament Settings screen — configuration only (no match-day ops).
 * Eligibility binds to settings.eligibilityRules (eligibilityEngine).
 * Group count uses the single Setup ↔ officialCompetition.groupCount path.
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
    registrationMode: current.registrationMode || "",
    scoringMethod: current.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY,
    roundTargets: { ...current.roundTargets },
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
      registrationMode: next.registrationMode || "",
      scoringMethod: next.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY,
      roundTargets: { ...next.roundTargets },
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
    if (
      draft.registrationMode !== OFFICIAL_REGISTRATION_MODE.INDIVIDUAL &&
      draft.registrationMode !== OFFICIAL_REGISTRATION_MODE.PAIR
    ) {
      setMessage({
        type: "error",
        text: "Phải chọn rõ chế độ đăng ký: Cá nhân hoặc Theo cặp.",
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

    setSaving(true);
    try {
      let next = patchOfficialCompetitionSettings(tournament, {
        registrationMode: draft.registrationMode,
        scoringMethod: selectedMethod,
        roundTargets: draft.roundTargets,
        groupCount,
      });

      const eligibilityPatch = updateEligibilityRules(next, {
        skill: {
          enabled: skillParsed.value != null,
          maxLevel: skillParsed.value,
          minLevel: eligibility.skill?.minLevel ?? null,
        },
        rating: {
          enabled: ratingParsed.value != null || eligibility.rating?.enabled === true,
          maxRating: ratingParsed.value,
          minRating: eligibility.rating?.minRating ?? null,
        },
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
        Thông tin cơ bản
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="Tên giải"
            value={tournament?.name || ""}
            InputLabelProps={fieldLabelProps}
            InputProps={{ readOnly: true }}
            helperText="Đổi tên qua luồng tạo/sửa giải hiện có nếu cần."
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
              <MenuItem value={OFFICIAL_MODE.OPEN}>Open (random có điều kiện)</MenuItem>
              <MenuItem value={OFFICIAL_MODE.AI_BALANCE}>AI Balance (seed/rating)</MenuItem>
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
              value={draft.registrationMode || ""}
              displayEmpty
              disabled={!canManage}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, registrationMode: e.target.value }))
              }
            >
              <MenuItem value="" disabled>
                — Chọn chế độ —
              </MenuItem>
              <MenuItem value={OFFICIAL_REGISTRATION_MODE.PAIR}>
                {OFFICIAL_REGISTRATION_MODE_LABELS[OFFICIAL_REGISTRATION_MODE.PAIR]}
              </MenuItem>
              <MenuItem value={OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}>
                {OFFICIAL_REGISTRATION_MODE_LABELS[OFFICIAL_REGISTRATION_MODE.INDIVIDUAL]}
              </MenuItem>
            </Select>
            <FormHelperText>
              Nội dung đôi vẫn có thể đăng ký cá nhân rồi ghép cặp khi bốc thăm.
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
            helperText="Chấp nhận thập phân (dấu . hoặc ,). Lưu số vào eligibilityRules.skill."
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
            helperText="Chấp nhận thập phân (dấu . hoặc ,). Lưu số vào eligibilityRules.rating."
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight={700}>
        Cách tính điểm
      </Typography>
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
          <MenuItem
            value={OFFICIAL_SCORING_METHOD.SIDE_OUT}
            disabled={!SIDEOUT_OPERATIONAL}
          >
            {OFFICIAL_SCORING_METHOD_LABELS[OFFICIAL_SCORING_METHOD.SIDE_OUT]}
            {!SIDEOUT_OPERATIONAL ? " — chưa sẵn sàng" : ""}
          </MenuItem>
          <MenuItem value={OFFICIAL_SCORING_METHOD.RALLY}>
            {OFFICIAL_SCORING_METHOD_LABELS[OFFICIAL_SCORING_METHOD.RALLY]}
          </MenuItem>
        </Select>
        <FormHelperText>
          {!SIDEOUT_OPERATIONAL
            ? "Truyền thống (Side-out) chưa sẵn sàng trên môi trường hiện tại. Hiện chỉ Rally vận hành."
            : INTENDED_NEW_TOURNAMENT_SCORING_METHOD === OFFICIAL_SCORING_METHOD.SIDE_OUT
              ? "Giải mới mặc định Truyền thống (Side-out); Rally vẫn tùy chọn."
              : "Chọn phương thức ghi điểm cho giải."}
        </FormHelperText>
      </FormControl>
      {!SIDEOUT_OPERATIONAL ? (
        <Alert severity="info">
          Side-out cần trạng thái giao bóng trên live match (gói SQL riêng). Không lưu được Side-out
          như chế độ vận hành cho đến khi gói đó được Owner duyệt/apply.
        </Alert>
      ) : null}

      <Typography variant="subtitle1" fontWeight={700}>
        Điểm đích theo vòng
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
