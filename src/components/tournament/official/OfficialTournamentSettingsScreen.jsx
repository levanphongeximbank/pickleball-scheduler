import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FormControl,
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
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_SCORING_METHOD_LABELS,
  OFFICIAL_ROUND_SCORE_KEY,
  OFFICIAL_ROUND_SCORE_LABELS,
  SIDEOUT_OPERATIONAL,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import {
  getEligibilityRules,
  updateEligibilityRules,
} from "../../../features/individual-tournament/engines/eligibilityEngine.js";

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
    scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
    roundTargets: { ...current.roundTargets },
    maxSkillLevel: eligibility.skill?.maxLevel ?? "",
    maxRating: eligibility.rating?.maxRating ?? "",
  }));
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = getOfficialCompetitionSettings(tournament);
    const nextEligibility = getEligibilityRules(tournament);
    setDraft({
      registrationMode: next.registrationMode || "",
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      roundTargets: { ...next.roundTargets },
      maxSkillLevel: nextEligibility.skill?.maxLevel ?? "",
      maxRating: nextEligibility.rating?.maxRating ?? "",
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
    setSaving(true);
    try {
      let next = patchOfficialCompetitionSettings(tournament, {
        registrationMode: draft.registrationMode,
        scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
        roundTargets: draft.roundTargets,
        groupCount,
      });

      const skillMax =
        draft.maxSkillLevel === "" || draft.maxSkillLevel == null
          ? null
          : Number(draft.maxSkillLevel);
      const ratingMax =
        draft.maxRating === "" || draft.maxRating == null ? null : Number(draft.maxRating);

      const eligibilityPatch = updateEligibilityRules(next, {
        skill: {
          enabled: skillMax != null,
          maxLevel: skillMax,
          minLevel: eligibility.skill?.minLevel ?? null,
        },
        rating: {
          enabled: ratingMax != null || eligibility.rating?.enabled === true,
          maxRating: ratingMax,
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
            InputProps={{ readOnly: true }}
            helperText="Đổi tên qua luồng tạo/sửa giải hiện có nếu cần."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Chiến lược ghép/bốc</InputLabel>
            <Select
              label="Chiến lược ghép/bốc"
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
            <InputLabel>Chế độ đăng ký</InputLabel>
            <Select
              label="Chế độ đăng ký"
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
            type="number"
            label="Trần trình độ (skill maxLevel)"
            value={draft.maxSkillLevel}
            disabled={!canManage}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, maxSkillLevel: e.target.value }))
            }
            helperText="Lưu vào settings.eligibilityRules.skill (eligibilityEngine)."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Trần rating (maxRating)"
            value={draft.maxRating}
            disabled={!canManage}
            onChange={(e) => setDraft((prev) => ({ ...prev, maxRating: e.target.value }))}
            helperText="Lưu vào settings.eligibilityRules.rating (eligibilityEngine)."
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight={700}>
        Cách tính điểm
      </Typography>
      <FormControl fullWidth size="small">
        <InputLabel>Phương thức ghi điểm</InputLabel>
        <Select
          label="Phương thức ghi điểm"
          value={OFFICIAL_SCORING_METHOD.RALLY}
          disabled={!canManage}
          onChange={() => {
            /* only Rally is operable */
          }}
        >
          <MenuItem value={OFFICIAL_SCORING_METHOD.RALLY}>
            {OFFICIAL_SCORING_METHOD_LABELS[OFFICIAL_SCORING_METHOD.RALLY]}
          </MenuItem>
          <MenuItem value={OFFICIAL_SCORING_METHOD.SIDE_OUT} disabled>
            {OFFICIAL_SCORING_METHOD_LABELS[OFFICIAL_SCORING_METHOD.SIDE_OUT]} — chưa vận hành
          </MenuItem>
        </Select>
      </FormControl>
      {!SIDEOUT_OPERATIONAL ? (
        <Alert severity="info">
          Side-out (chỉ bên giao bóng ghi điểm) chưa được hỗ trợ trên bảng điểm trọng tài Official
          hiện tại. Chỉ dùng Rally cho đến khi backend có trạng thái giao bóng chuẩn.
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
