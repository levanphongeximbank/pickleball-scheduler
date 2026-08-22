import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
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
import {
  buildOfficialSettingsCanonicalFingerprint,
  buildOfficialSettingsDraftFromTournament,
} from "../../../features/individual-tournament/engines/officialSettingsDraftModel.js";
import { buildOfficialMatchRulesSummaryLines } from "../../../features/individual-tournament/engines/officialScoringRulesResolver.js";
import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import { allowedOfficialRegistrationModes } from "../../../features/individual-tournament/engines/officialCompetitionStrategyEngine.js";
import { patchOfficialVisibleEligibilityLimits } from "../../../features/individual-tournament/engines/eligibilityEngine.js";

const fieldLabelProps = { shrink: true };

/**
 * Tournament Settings screen — configuration only (no match-day ops).
 * Local draft is dirty-stable: soft-poll / token refresh must not wipe unsaved edits.
 * One primary save: "Lưu cài đặt" → canonical tournament.name + officialCompetition.
 */
export default function OfficialTournamentSettingsScreen({
  tournament,
  officialMode,
  onOfficialModeChange,
  groupCount,
  canManage = true,
  onPersistSettings,
}) {
  const current = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const canonicalFingerprint = useMemo(
    () => buildOfficialSettingsCanonicalFingerprint(tournament),
    [tournament]
  );
  const [draft, setDraft] = useState(() =>
    buildOfficialSettingsDraftFromTournament(tournament)
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Rehydrate only when canonical fingerprint changes AND draft is clean.
    // Soft-poll with identical content keeps the same fingerprint → no wipe.
    if (dirty) return;
    setDraft(buildOfficialSettingsDraftFromTournament(tournament));
  }, [canonicalFingerprint, dirty, tournament]);

  const updateDraft = (patch) => {
    setDirty(true);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const rulesPreview = useMemo(
    () =>
      buildOfficialMatchRulesSummaryLines(
        {
          ...tournament,
          name: draft.tournamentName,
          settings: {
            ...(tournament?.settings || {}),
            officialCompetition: {
              ...(tournament?.settings?.officialCompetition || {}),
              scoringMethod: draft.scoringMethod,
              matchFormat: draft.matchFormat,
              roundTargets: draft.roundTargets,
            },
          },
        },
        { stage: "group" }
      ),
    [tournament, draft]
  );

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
        // G2-G: do not dual-write Group 2 into settings.officialCompetition.
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
      setDirty(false);
      setDraft(buildOfficialSettingsDraftFromTournament(saved.tournament || next));
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

      {dirty ? (
        <Alert severity="warning">
          Có thay đổi chưa lưu. Chọn nhiều trường rồi bấm <strong>Lưu cài đặt</strong> một lần —
          soft refresh sẽ không xóa bản nháp khi đang chỉnh.
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
            onChange={(e) => updateDraft({ tournamentName: e.target.value })}
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
            <FormHelperText>
              Chiến lược ghép/bốc lưu ngay khi đổi (riêng với form luật bên dưới).
            </FormHelperText>
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
              onChange={(e) => updateDraft({ registrationMode: e.target.value })}
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
                : "Giữ lựa chọn trong bản nháp cho đến khi Lưu cài đặt."}
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
            disabled
            InputLabelProps={fieldLabelProps}
            inputProps={{ min: 1, max: 16 }}
            helperText="LEGACY hiển thị — authority: Nội dung → Nhóm 2 (events[].competitionRules). Không ghi officialCompetition.groupCount."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Suất vào knockout mỗi bảng"
            value={draft.qualifiersPerGroup ?? 2}
            disabled
            InputLabelProps={fieldLabelProps}
            inputProps={{ min: 1, max: 8 }}
            helperText="LEGACY hiển thị — chỉnh ở Settings Nội dung (Nhóm 2). Không dual-write Tournament."
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
            onChange={(e) => updateDraft({ maxSkillLevel: e.target.value })}
            helperText="Để trống nếu không giới hạn."
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
            onChange={(e) => updateDraft({ maxRating: e.target.value })}
            helperText="Để trống nếu không giới hạn."
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
              onChange={(e) => updateDraft({ scoringMethod: e.target.value })}
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
                ? "Rally: mỗi rally ghi 1 điểm. Side-out chưa vận hành trên live Official."
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
              onChange={(e) => updateDraft({ matchFormat: e.target.value })}
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
            <FormHelperText>{OFFICIAL_MATCH_FORMAT_HELPERS[matchFormatValue]}</FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
      {!SIDEOUT_OPERATIONAL ? (
        <Alert severity="info">
          Side-out chưa operational trên Official.
        </Alert>
      ) : (
        <Alert severity="success">
          Side-out đã bind CORE-16 qua Adapter B. Link trọng tài cần kèm rules query (từ màn phân
          công). Durable serve SSOT vẫn cần Edge match_live_states.
        </Alert>
      )}
      {!BEST_OF_3_OPERATIONAL ? (
        <Alert severity="info">{BEST_OF_3_SHARED_CAPABILITY_GAP}</Alert>
      ) : null}
      {WIN_BY_POLICY_DEFERRED ? (
        <Alert severity="info">
          Thắng cách (win-by) đang deferred — không hardcode winBy=2 trên Official classic.
        </Alert>
      ) : (
        <Alert severity="success">
          Win-by do CORE-16 enforce (đích + thắng cách + point cap khi cấu hình).
        </Alert>
      )}
      <Alert severity="warning">
        Đổi sân / change-end: PARTIAL — phát hiện mốc + session ACK trên console trọng tài; chưa
        durable court orientation SSOT. Không bật operable Settings control.
      </Alert>

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
                updateDraft({
                  roundTargets: {
                    ...draft.roundTargets,
                    [key]: Number(e.target.value) || draft.roundTargets[key],
                  },
                })
              }
              helperText="Độc lập với thể thức Best of."
            />
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2" fontWeight={800}>
              Tóm tắt luật hiệu lực
            </Typography>
            <Chip size="small" color="info" label={rulesPreview.summaryLabel} />
          </Stack>
          {rulesPreview.lines.map((line) => (
            <Typography
              key={line.key}
              variant="body2"
              color={line.unavailable ? "text.secondary" : "text.primary"}
            >
              {line.label}: {line.value}
            </Typography>
          ))}
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="contained"
          size="large"
          disabled={!canManage || saving}
          onClick={handleSave}
        >
          {saving ? "Đang lưu…" : "Lưu cài đặt"}
        </Button>
        {dirty ? <Chip color="warning" label="Chưa lưu" size="small" /> : null}
      </Stack>
    </Stack>
  );
}
