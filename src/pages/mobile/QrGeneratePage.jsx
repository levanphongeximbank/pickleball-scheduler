import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QrCode2Icon from "@mui/icons-material/QrCode2";

import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import QrDisplayCard from "../../features/mobile/components/QrDisplayCard.jsx";
import {
  QR_ENTITY_TYPES,
  QR_ENTITY_LABELS,
} from "../../features/mobile/constants/qrEntityTypes.js";
import { createQrToken } from "../../features/mobile/services/qrTokenService.js";
import { MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";

export default function QrGeneratePage() {
  const { activeClubId } = useClub();
  const { currentTenantId } = useTenant();
  const [entityType, setEntityType] = useState(QR_ENTITY_TYPES.PLAYER);
  const [entityId, setEntityId] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [qrResult, setQrResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId]
  );

  const handleGenerate = async () => {
    setError("");
    setQrResult(null);
    if (!entityId) {
      setError("Chọn hoặc nhập đối tượng cần tạo QR.");
      return;
    }
    setLoading(true);
    const result = await createQrToken({
      entityType,
      entityId,
      tenantId: currentTenantId,
      tournamentId: tournamentId || null,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQrResult(result);
  };

  return (
    <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <QrCode2Icon color="primary" />
        <Typography variant="h5" fontWeight={900}>
          Tạo QR Code
        </Typography>
      </Stack>

      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <Alert severity="info">
          Chọn loại QR và đối tượng để tạo mã check-in hoặc xác nhận tham gia nhanh trên thiết bị di động.
        </Alert>

        <FormControl fullWidth>
          <InputLabel>Loại QR</InputLabel>
          <Select
            value={entityType}
            label="Loại QR"
            onChange={(e) => {
              setEntityType(e.target.value);
              setEntityId("");
            }}
          >
            {Object.values(QR_ENTITY_TYPES).map((type) => (
              <MenuItem key={type} value={type}>
                {QR_ENTITY_LABELS[type]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {entityType === QR_ENTITY_TYPES.PLAYER && players.length > 0 ? (
          <FormControl fullWidth>
            <InputLabel>Người chơi</InputLabel>
            <Select
              value={entityId}
              label="Người chơi"
              onChange={(e) => setEntityId(e.target.value)}
            >
              {players.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label="ID đối tượng"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            fullWidth
            helperText="Nhập ID người chơi, trận, sân..."
          />
        )}

        <TextField
          label="Tournament ID (tuỳ chọn)"
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}

        {qrResult?.payload && (
          <Alert severity="success">
            QR đã sẵn sàng. Bạn có thể tải ảnh hoặc chia sẻ cho người dùng quét.
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleGenerate}
          disabled={loading || !entityId}
          sx={{ minHeight: 56 }}
        >
          {loading ? "Đang tạo..." : "Tạo QR"}
        </Button>

        {qrResult?.payload && (
          <>
            <Alert severity="success">
              Mã QR mới đã được tạo cho {QR_ENTITY_LABELS[entityType].toLowerCase()}. Bạn có thể tải hoặc chia sẻ ngay.
            </Alert>
            <QrDisplayCard
              payload={qrResult.payload}
              title={QR_ENTITY_LABELS[entityType]}
              subtitle={`Hết hạn: ${new Date(qrResult.record.expires_at).toLocaleString("vi-VN")}`}
            />
          </>
        )}

        {!qrResult?.payload && !loading && (
          <Typography variant="body2" color="text.secondary">
            Sau khi tạo xong, mã QR sẽ hiển thị ngay ở đây để bạn tải hoặc chia sẻ.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
