import { useState } from "react";

import {

  Alert,

  Box,

  Button,

  Stack,

  Tab,

  Tabs,

  TextField,

  Typography,

} from "@mui/material";

import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";



import { useClub } from "../../context/ClubContext.jsx";

import { useTenant } from "../../context/TenantContext.jsx";

import QrScanner from "../../features/mobile/components/QrScanner.jsx";

import {

  processQrCheckin,

  resolveManualQrInput,

} from "../../features/mobile/services/checkInService.js";

import CheckInStatusChip from "../../features/mobile/components/CheckInStatusChip.jsx";

import { MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";

import { Link } from "react-router-dom";



export default function QrScanPage() {

  const { activeClubId, activeClub } = useClub();

  const { currentTenantId } = useTenant();

  const [tab, setTab] = useState(0);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [manualCode, setManualCode] = useState("");



  const venueId = activeClub?.venueId || null;



  const runCheckin = async (rawToken) => {

    setLoading(true);

    setResult(null);

    const scanResult = await processQrCheckin({

      rawToken,

      tenantId: currentTenantId,

      venueId,

      clubId: activeClubId,

    });

    setResult(scanResult);

    setLoading(false);

  };



  const handleScan = async (token) => {

    await runCheckin(token);

  };



  const handleManualSubmit = async () => {

    const resolved = resolveManualQrInput(manualCode);

    if (!resolved.ok) {

      setResult(resolved);

      return;

    }

    await runCheckin(resolved.token);

  };



  return (

    <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>

        <QrCodeScannerIcon color="primary" />

        <Typography variant="h5" fontWeight={900}>

          Quét QR Check-in

        </Typography>

      </Stack>



      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>

        <Tab label="Quét QR" />

        <Tab label="Nhập mã" />

        <Tab label="Hướng dẫn" />

      </Tabs>



      {tab === 0 && (

        <Stack spacing={2}>

          <QrScanner

            active={tab === 0}

            onScan={handleScan}

            onError={(msg) => setResult({ ok: false, error: msg })}

          />



          {loading && <Alert severity="info">Đang xử lý...</Alert>}



          {result && (

            <Alert severity={result.ok ? "success" : "warning"}>

              <Stack spacing={1}>

                <Typography fontWeight={700}>

                  {result.ok ? "Check-in thành công!" : result.error || "Không thể xử lý mã QR này."}

                </Typography>

                {result.status && <CheckInStatusChip status={result.status} />}

                {result.offline && (

                  <Typography variant="caption">

                    Đã lưu tạm — sẽ đồng bộ và validate lại khi có mạng.

                  </Typography>

                )}

                {!result.ok && (

                  <Typography variant="caption" color="text.secondary">

                    Hãy thử lại sau hoặc quay về dashboard để kiểm tra trạng thái hiện tại.

                  </Typography>

                )}

              </Stack>

            </Alert>

          )}



          <Button component={Link} to="/mobile/check-in" variant="outlined" sx={{ minHeight: 48 }}>

            Xem Dashboard Check-in

          </Button>

        </Stack>

      )}



      {tab === 1 && (

        <Stack spacing={2}>

          <Typography variant="body2" color="text.secondary">

            Nhập mã check-in từ BTC hoặc dán payload <code>pbs://checkin/...</code>

          </Typography>

          <TextField

            label="Mã check-in"

            value={manualCode}

            onChange={(event) => setManualCode(event.target.value)}

            fullWidth

            multiline

            minRows={2}

            placeholder="pbs://checkin/abc123..."

          />

          <Button

            variant="contained"

            onClick={handleManualSubmit}

            disabled={loading || !manualCode.trim()}

            sx={{ minHeight: 48 }}

          >

            Xác nhận check-in

          </Button>



          {loading && <Alert severity="info">Đang xử lý...</Alert>}



          {result && (

            <Alert severity={result.ok ? "success" : "warning"}>

              <Typography fontWeight={700}>

                {result.ok ? "Check-in thành công!" : result.error || "Mã không hợp lệ."}

              </Typography>

            </Alert>

          )}

        </Stack>

      )}



      {tab === 2 && (

        <Stack spacing={1.5}>

          <Typography variant="body2">

            1. Bấm &quot;Bật camera&quot; và cho phép truy cập camera trên thiết bị.

          </Typography>

          <Typography variant="body2">

            2. Đưa mã QR vào khung hình — hệ thống tự nhận diện trong vài giây.

          </Typography>

          <Typography variant="body2">

            3. Tab &quot;Nhập mã&quot; dùng khi camera không khả dụng.

          </Typography>

          <Typography variant="body2" color="text.secondary">

            Nếu QR hết hạn, sai tenant/venue hoặc đã check-in trước đó, hệ thống sẽ hiện lý do rõ ràng.

          </Typography>

          <Button component={Link} to="/mobile/check-in" variant="outlined" sx={{ mt: 1, minHeight: 48 }}>

            Mở dashboard check-in

          </Button>

        </Stack>

      )}

    </Box>

  );

}

