import SearchIcon from "@mui/icons-material/Search";
import GroupsIcon from "@mui/icons-material/Groups";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import SportsTennisRoundedIcon from "@mui/icons-material/SportsTennisRounded";
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { getPlayerSkillLevel, athleteGenderDisplayLabel, normalizeAthleteGender } from "../../../models/player.js";
import {
  filterTournamentPickerPlayers,
  ALL_CLUBS_FILTER,
} from "../../../utils/tournamentPlayerPicker.js";

const ACCENT = "#7CFFB2";
const PANEL_BG = "rgba(10, 20, 36, 0.92)";
const PANEL_BORDER = "1px solid rgba(124,255,178,0.18)";

function ratingOf(player) {
  const value = Number(getPlayerSkillLevel(player));
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function genderLabel(player) {
  return athleteGenderDisplayLabel(player?.gender ?? player);
}

function AvatarCircle({ label, size = 36, dimmed = false, player = null }) {
  const avatarUrl = String(
    player?.avatarUrl ||
      player?.avatar_url ||
      player?.photoUrl ||
      player?.photo_url ||
      ""
  ).trim();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        bgcolor: dimmed ? "rgba(255,255,255,0.04)" : "rgba(124,255,178,0.12)",
        border: dimmed
          ? "1px dashed rgba(255,255,255,0.2)"
          : "1px solid rgba(124,255,178,0.35)",
        color: dimmed ? "rgba(244,247,251,0.35)" : ACCENT,
        fontWeight: 800,
        fontSize: size > 32 ? "0.85rem" : "0.7rem",
      }}
    >
      {avatarUrl ? (
        <Box
          component="img"
          src={avatarUrl}
          alt=""
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        label
      )}
    </Box>
  );
}

function GenderTab({ active, label, onClick }) {
  return (
    <Button
      size="small"
      onClick={onClick}
      sx={{
        minWidth: 0,
        px: 1.5,
        py: 0.5,
        borderRadius: 999,
        textTransform: "none",
        fontWeight: 700,
        color: active ? "#061018" : "rgba(244,247,251,0.75)",
        bgcolor: active ? ACCENT : "transparent",
        border: active ? "none" : "1px solid rgba(255,255,255,0.16)",
        "&:hover": {
          bgcolor: active ? ACCENT : "rgba(255,255,255,0.06)",
        },
      }}
    >
      {label}
    </Button>
  );
}

export default function TeamAiPairingConfigBoard({
  players = [],
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearFiltered,
  onClearAll,
  genderFilter = "all",
  onGenderFilterChange,
  search = "",
  onSearchChange,
  excludePlayerIds = [],
  focusTeam = null,
  focusRoster = [],
  focusStats = { male: 0, female: 0 },
  teams = [],
  focusTeamIndex = 0,
  onFocusTeam,
  teamCount,
  onTeamCountChange,
  groupCount,
  onGroupCountChange,
  onPair,
  pairDisabled = false,
  pairingBusy = false,
  onStartGroups,
  canStartGroups = false,
  onAddNew,
}) {
  const filtered = filterTournamentPickerPlayers(players, {
    clubFilter: ALL_CLUBS_FILTER,
    genderFilter,
    search,
    excludePlayerIds,
  });

  const totalCount = players.length;
  const displayedCount = filtered.length;
  const selectedCount = selectedIds.length;
  const canonicalGenderFilter =
    genderFilter === "all" ? "all" : normalizeAthleteGender(genderFilter);

  const avgPreview = focusRoster.length
    ? (
        focusRoster.reduce((sum, p) => sum + Number(getPlayerSkillLevel(p) || 0), 0) /
        focusRoster.length
      ).toFixed(2)
    : "—";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1.05fr 1.15fr 0.95fr" },
        gap: 1.75,
        alignItems: "stretch",
        minHeight: { lg: 540 },
      }}
    >
      {/* LEFT — athlete list */}
      <Box
        sx={{
          bgcolor: PANEL_BG,
          border: PANEL_BORDER,
          borderRadius: 2.5,
          p: 1.75,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.25}>
          <Typography fontWeight={800} fontSize="1.05rem">
            Danh sách VĐV
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} mb={1.25} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`Tổng VĐV: ${totalCount}`}
            sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "#f4f7fb", fontWeight: 700 }}
          />
          <Chip
            size="small"
            label={`Đang hiển thị: ${displayedCount}`}
            sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "#f4f7fb", fontWeight: 700 }}
          />
          <Chip
            size="small"
            label={`Đã chọn: ${selectedCount}`}
            sx={{
              bgcolor: "rgba(124,255,178,0.12)",
              color: ACCENT,
              border: "1px solid rgba(124,255,178,0.35)",
              fontWeight: 700,
            }}
          />
        </Stack>

        <TextField
          size="small"
          placeholder="Tìm tên VĐV…"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          fullWidth
          sx={{
            mb: 1.25,
            "& .MuiOutlinedInput-root": {
              color: "#f4f7fb",
              bgcolor: "rgba(255,255,255,0.04)",
              borderRadius: 2,
              "& fieldset": { borderColor: "rgba(255,255,255,0.14)" },
              "&:hover fieldset": { borderColor: "rgba(124,255,178,0.35)" },
              "&.Mui-focused fieldset": { borderColor: ACCENT },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "rgba(244,247,251,0.45)" }} fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Stack direction="row" spacing={0.75} mb={1.25}>
          <GenderTab
            active={canonicalGenderFilter === "all"}
            label="Tất cả"
            onClick={() => onGenderFilterChange?.("all")}
          />
          <GenderTab
            active={canonicalGenderFilter === "male"}
            label="Nam"
            onClick={() => onGenderFilterChange?.("male")}
          />
          <GenderTab
            active={canonicalGenderFilter === "female"}
            label="Nữ"
            onClick={() => onGenderFilterChange?.("female")}
          />
        </Stack>

        <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            onClick={() => onSelectAll?.(filtered.map((p) => String(p.id)))}
            sx={{ color: ACCENT, textTransform: "none", fontWeight: 700 }}
          >
            Chọn đang hiện
          </Button>
          <Button
            size="small"
            onClick={() => onClearFiltered?.(filtered.map((p) => String(p.id)))}
            sx={{ color: "rgba(244,247,251,0.55)", textTransform: "none" }}
          >
            Bỏ chọn đang hiện
          </Button>
          <Button
            size="small"
            onClick={onClearAll}
            sx={{ color: "rgba(244,247,251,0.55)", textTransform: "none" }}
          >
            Bỏ chọn tất cả
          </Button>
          {onAddNew ? (
            <Button
              size="small"
              onClick={onAddNew}
              sx={{ color: "rgba(244,247,251,0.7)", textTransform: "none" }}
            >
              + Thêm VĐV
            </Button>
          ) : null}
        </Stack>

        <Stack spacing={0.85} sx={{ flex: 1, minHeight: 280, maxHeight: 420, overflow: "auto", pr: 0.5 }}>
          {filtered.map((player) => {
            const id = String(player.id);
            const selected = selectedIds.includes(id);
            const initial = String(player.name || "?").trim().charAt(0).toUpperCase();
            return (
              <Box
                key={id}
                onClick={() => onToggle?.(id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: 2,
                  cursor: "pointer",
                  bgcolor: selected ? "rgba(124,255,178,0.12)" : "rgba(255,255,255,0.03)",
                  border: selected
                    ? "1px solid rgba(124,255,178,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                  transition: "background-color 160ms ease, border-color 160ms ease",
                  "&:hover": {
                    bgcolor: selected
                      ? "rgba(124,255,178,0.16)"
                      : "rgba(255,255,255,0.06)",
                  },
                }}
              >
                <AvatarCircle label={initial} player={player} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {player.name || id}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {genderLabel(player)}
                  </Typography>
                </Box>
                <Typography fontWeight={800} color={ACCENT} sx={{ flex: "0 0 auto" }}>
                  {ratingOf(player)}
                </Typography>
              </Box>
            );
          })}
          {!filtered.length ? (
            <Typography variant="body2" sx={{ opacity: 0.55, py: 2, textAlign: "center" }}>
              Không có VĐV phù hợp.
            </Typography>
          ) : null}
        </Stack>

        <Typography variant="caption" sx={{ opacity: 0.45, mt: 1.25 }}>
          Chọn VĐV rồi bấm Ghép đội — AI phân bổ vào các đội.
        </Typography>
      </Box>

      {/* CENTER — focus team */}
      <Box
        sx={{
          bgcolor: PANEL_BG,
          border: "1px solid rgba(124,255,178,0.55)",
          boxShadow: "0 0 28px rgba(124,255,178,0.12), inset 0 0 0 1px rgba(124,255,178,0.12)",
          borderRadius: 2.5,
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography fontWeight={900} fontSize="1.65rem" lineHeight={1.15}>
              {focusTeam?.name || "Đội đang ghép"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.65, mt: 0.35 }}>
              {focusTeam
                ? `Seed #${focusTeam.seed || focusTeamIndex + 1}`
                : "Chưa có kết quả — chọn VĐV để ghép"}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${focusRoster.length}/4`}
            sx={{
              fontWeight: 800,
              bgcolor: "rgba(124,255,178,0.15)",
              color: ACCENT,
              border: "1px solid rgba(124,255,178,0.4)",
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`${focusStats.male} Nam`}
            sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "#f4f7fb" }}
          />
          <Chip
            size="small"
            label={`${focusStats.female} Nữ`}
            sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "#f4f7fb" }}
          />
          <Chip
            size="small"
            label={`TB ${avgPreview}`}
            sx={{ bgcolor: "rgba(124,255,178,0.1)", color: ACCENT }}
          />
        </Stack>

        <Stack spacing={1} sx={{ flex: 1 }}>
          {[0, 1, 2, 3].map((slot) => {
            const player = focusRoster[slot];
            const initial = player
              ? String(player.name || "?").trim().charAt(0).toUpperCase()
              : "+";
            return (
              <Box
                key={`slot-${slot}`}
                sx={{
                  minHeight: 64,
                  px: 1.5,
                  py: 1.1,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  border: player
                    ? "1px solid rgba(124,255,178,0.35)"
                    : "1px dashed rgba(255,255,255,0.22)",
                  bgcolor: player ? "rgba(124,255,178,0.08)" : "rgba(255,255,255,0.02)",
                }}
              >
                <AvatarCircle
                  label={player ? initial : "+"}
                  dimmed={!player}
                  size={40}
                  player={player}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {player?.name || "Chọn hoặc kéo thả VĐV"}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.55 }}>
                    {player ? `${genderLabel(player)} · ${ratingOf(player)}` : `Vị trí ${slot + 1}`}
                  </Typography>
                </Box>
                {player ? (
                  <Typography fontWeight={800} color={ACCENT}>
                    {ratingOf(player)}
                  </Typography>
                ) : null}
              </Box>
            );
          })}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="stretch">
          <TextField
            label="Số đội"
            type="number"
            size="small"
            value={teamCount}
            onChange={(event) =>
              onTeamCountChange?.(Math.max(2, Number(event.target.value) || 2))
            }
            inputProps={{ min: 2, max: 20 }}
            sx={{
              width: "50%",
              "& .MuiInputBase-root": { color: "#f4f7fb" },
              "& .MuiInputLabel-root": { color: "rgba(244,247,251,0.65)" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
            }}
          />
          <TextField
            label="Số bảng"
            type="number"
            size="small"
            value={groupCount}
            onChange={(event) =>
              onGroupCountChange?.(Math.max(2, Number(event.target.value) || 2))
            }
            inputProps={{ min: 2, max: 8 }}
            sx={{
              width: "50%",
              "& .MuiInputBase-root": { color: "#f4f7fb" },
              "& .MuiInputLabel-root": { color: "rgba(244,247,251,0.65)" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
            }}
          />
        </Stack>

        {canStartGroups ? (
          <Button
            fullWidth
            variant="outlined"
            onClick={onStartGroups}
            sx={{
              borderColor: "rgba(124,255,178,0.45)",
              color: ACCENT,
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            Chia bảng ngay
          </Button>
        ) : null}
      </Box>

      {/* RIGHT — formed teams */}
      <Box
        sx={{
          bgcolor: PANEL_BG,
          border: PANEL_BORDER,
          borderRadius: 2.5,
          p: 1.75,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.25}>
          <Typography fontWeight={800} fontSize="1.05rem">
            Các đội đã chia
          </Typography>
          <Chip
            size="small"
            label={teams.length ? `${teams.length} đội` : "Chưa ghép"}
            sx={{
              bgcolor: teams.length ? "rgba(124,255,178,0.12)" : "rgba(255,255,255,0.06)",
              color: teams.length ? ACCENT : "rgba(244,247,251,0.55)",
              fontWeight: 700,
            }}
          />
        </Stack>

        <Stack spacing={1} sx={{ flex: 1, maxHeight: 480, overflow: "auto", pr: 0.5 }}>
          {teams.map((team, index) => {
            const roster = (team.playerIds || [])
              .map((id) => players.find((p) => String(p.id) === String(id)))
              .filter(Boolean);
            const active = index === focusTeamIndex;
            return (
              <Box
                key={team.id}
                onClick={() => onFocusTeam?.(index)}
                sx={{
                  p: 1.35,
                  borderRadius: 2,
                  cursor: "pointer",
                  border: active
                    ? "1px solid rgba(124,255,178,0.55)"
                    : "1px solid rgba(255,255,255,0.1)",
                  bgcolor: active ? "rgba(124,255,178,0.1)" : "rgba(255,255,255,0.03)",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={800}>{team.name}</Typography>
                  <Chip
                    size="small"
                    label={`${roster.length}/4`}
                    sx={{ height: 22, fontWeight: 700 }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ opacity: 0.65, display: "block", mt: 0.35 }}>
                  Seed #{team.seed || index + 1} · TB {Number(team.avgLevel || 0).toFixed(2)}
                </Typography>
                <Stack direction="row" spacing={0.6} mt={1}>
                  {[0, 1, 2, 3].map((slot) => {
                    const player = roster[slot];
                    return (
                      <AvatarCircle
                        key={`${team.id}-${slot}`}
                        size={28}
                        dimmed={!player}
                        player={player}
                        label={
                          player
                            ? String(player.name || "?").trim().charAt(0).toUpperCase()
                            : "·"
                        }
                      />
                    );
                  })}
                </Stack>
              </Box>
            );
          })}

          {!teams.length ? (
            <Box
              sx={{
                flex: 1,
                minHeight: 160,
                borderRadius: 2,
                border: "1px dashed rgba(255,255,255,0.18)",
                display: "grid",
                placeItems: "center",
                px: 2,
                textAlign: "center",
                color: "rgba(244,247,251,0.45)",
              }}
            >
              Đội mới sẽ hiện ở đây sau khi ghép
            </Box>
          ) : (
            <Box
              sx={{
                mt: 0.5,
                py: 1.5,
                borderRadius: 2,
                border: "1px dashed rgba(255,255,255,0.14)",
                textAlign: "center",
                color: "rgba(244,247,251,0.4)",
                fontSize: "0.85rem",
              }}
            >
              Đội mới sẽ được tạo tiếp theo
            </Box>
          )}
        </Stack>
      </Box>

      <Button
        fullWidth
        size="large"
        variant="contained"
        startIcon={<GroupsIcon />}
        onClick={onPair}
        disabled={pairDisabled || pairingBusy}
        sx={{
          gridColumn: { xs: "1", lg: "1 / -1" },
          width: { xs: "100%", lg: 385 },
          justifySelf: "center",
          py: 1.35,
          borderRadius: 1.5,
          fontWeight: 900,
          fontSize: "1.25rem",
          textTransform: "none",
          bgcolor: ACCENT,
          color: "#061018",
          boxShadow: "0 8px 28px rgba(124,255,178,0.28)",
          "&:hover": { bgcolor: "#9affc6" },
          "&.Mui-disabled": {
            bgcolor: "rgba(124,255,178,0.25)",
            color: "rgba(6,16,24,0.45)",
          },
        }}
      >
        {pairingBusy ? "Đang ghép…" : "Ghép đội"}
      </Button>
    </Box>
  );
}

export function DarkDialogHeader({ title, subtitle, onClose }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="flex-start"
      sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1 }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <SportsTennisRoundedIcon sx={{ color: ACCENT, fontSize: 38 }} />
        <Box>
          <Typography fontWeight={900} fontSize={{ xs: "1.35rem", md: "1.6rem" }} color="#f4f7fb">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ color: "rgba(244,247,251,0.55)", mt: 0.1 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button
          startIcon={<HelpOutlineRoundedIcon />}
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            color: "rgba(244,247,251,.78)",
            border: "1px solid rgba(255,255,255,.13)",
            textTransform: "none",
          }}
        >
          Hướng dẫn
        </Button>
        {onClose ? (
          <IconButton
            onClick={onClose}
            sx={{
              color: "rgba(244,247,251,0.7)",
              border: "1px solid rgba(255,255,255,.13)",
              borderRadius: 1.5,
            }}
            aria-label="Đóng"
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </Stack>
    </Stack>
  );
}
