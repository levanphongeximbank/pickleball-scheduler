import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { loadAIData, saveAIData, resetAIData } from "../ai/storage";
import { buildDebugSummary } from "../ai/debugPanel";
import { useClub } from "../context/ClubContext.jsx";
import {
  getCloudSyncMode,
  getLastCloudSync,
  pullAIDataFromCloud,
  syncAIDataToCloud,
} from "../ai/cloudSync";
import { getScopedSnapshotsKey } from "../domain/clubStorage.js";
import { SNAPSHOT_CAP } from "../ai/config.js";
import { usePlatformRuntime } from "../core/platform/app/usePlatformRuntime.js";
import { buildRuntimeAccessState } from "../core/platform/app/runtimeAccess.js";
import RbacDevPanel from "../components/settings/RbacDevPanel.jsx";
import VenueOnboardingPanel from "../components/settings/VenueOnboardingPanel.jsx";
import VenueStaffPanel from "../components/settings/VenueStaffPanel.jsx";
import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import { seedDemoClubsRoster } from "../demo/seed/demoClubsRosterSeed.js";
import { purgeDemoSeedData } from "../demo/seed/purgeDemoSeed.js";

function loadSnapshots(clubId) {
  try {
    const raw = localStorage.getItem(getScopedSnapshotsKey(clubId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshots(clubId, snapshots) {
  localStorage.setItem(getScopedSnapshotsKey(clubId), JSON.stringify(snapshots));
}

export default function Settings() {
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const runtime = usePlatformRuntime();
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [demoSeedOpen, setDemoSeedOpen] = useState(false);
  const [demoPurgeOpen, setDemoPurgeOpen] = useState(false);
  const [snapshots, setSnapshots] = useState(() => loadSnapshots(activeClubId));
  const [dataVersion, setDataVersion] = useState(0);
  const [platformPreview, setPlatformPreview] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  useEffect(() => {
    setSnapshots(loadSnapshots(activeClubId));
    setDataVersion((value) => value + 1);
  }, [activeClubId, revision]);

  useEffect(() => {
    try {
      const existingTenant = runtime.tenantService.list()[0];

      if (!existingTenant) {
        const tenantId = `tenant-preview-${Date.now()}`;
        const seed = runtime.initializeSeed({
          tenantInput: {
            name: activeClub?.name || "Preview Tenant",
            tenant_id: tenantId,
            plan: "trial",
          },
          subscriptionInput: {
            tenant_id: tenantId,
            plan: "trial",
            feature_flags: { mobile: true, ai: false },
          },
        });

        setPlatformPreview({
          status: "initialized",
          tenantName: seed.tenant.name,
          tenantId: seed.tenant.tenant_id,
          plan: seed.tenant.plan,
          mobileEnabled: runtime.subscriptionService.hasFeature(seed.tenant.tenant_id, "mobile"),
          aiEnabled: runtime.subscriptionService.hasFeature(seed.tenant.tenant_id, "ai"),
        });
        return;
      }

      const accessState = buildRuntimeAccessState(
        runtime,
        {
          user_id: "demo-admin",
          tenant_id: existingTenant.tenant_id,
          role: "SUPER_ADMIN",
        },
        "system.setting",
        existingTenant.tenant_id,
        { source: "settings.page" }
      );

      setAccessAllowed(accessState.allowed);
      const subscription = runtime.subscriptionService.getByTenant(existingTenant.tenant_id);
      setPlatformPreview({
        status: "ready",
        tenantName: existingTenant.name,
        tenantId: existingTenant.tenant_id,
        plan: existingTenant.plan,
        mobileEnabled: runtime.subscriptionService.hasFeature(existingTenant.tenant_id, "mobile"),
        aiEnabled: runtime.subscriptionService.hasFeature(existingTenant.tenant_id, "ai"),
        subscriptionStatus: subscription?.status || "unknown",
        access: accessState.allowed ? "allowed" : "denied",
      });
    } catch (error) {
      setPlatformPreview({ status: "error", message: error.message });
    }
  }, [activeClub?.name, runtime]);

  const aiData = useMemo(
    () => loadAIData(activeClubId),
    [activeClubId, dataVersion]
  );
  const lastCloudSync = useMemo(
    () => getLastCloudSync(activeClubId),
    [activeClubId, dataVersion]
  );
  const cloudSyncMode = useMemo(() => getCloudSyncMode(), []);
  const isProductionBuild = import.meta.env.PROD;
  const backupAvailable = exportText.trim().length > 0;

  const debugSummary = useMemo(() => {
    const summary = buildDebugSummary({
      courts: aiData.sessions?.[0]?.courts || [],
      waiting: aiData.sessions?.[0]?.waiting || [],
      aiScore: { total: 0 },
      candidates: [],
      explanation: [],
    });

    return `Sân: ${summary.totalCourts} • Người chờ: ${summary.waitingCount} • Điểm AI: ${summary.aiScore}`;
  }, [aiData]);

  const handleExport = () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    const data = loadAIData(activeClubId);
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const text = JSON.stringify(backup, null, 2);
    setExportText(text);
    setStatusMessage({ type: "success", text: "Dữ liệu đã được xuất thành công." });
  };

  const handleSeedDemoRoster = () => {
    const result = seedDemoClubsRoster({ playersPerClub: 60 });
    setDemoSeedOpen(false);

    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error || "Không thể tạo dữ liệu demo." });
      return;
    }

    refreshClubs();
    setDataVersion((value) => value + 1);
    setStatusMessage({
      type: "success",
      text: `Đã tạo ${result.clubs.length} CLB với tổng ${result.totalPlayers} VĐV (mỗi CLB 60 người).`,
    });
  };

  const handlePurgeDemoSeed = () => {
    const result = purgeDemoSeedData();
    setDemoPurgeOpen(false);

    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error || "Không thể dọn dữ liệu demo." });
      return;
    }

    refreshClubs();
    setDataVersion((value) => value + 1);
    setStatusMessage({
      type: "success",
      text: `Đã xóa ${result.removedClubIds.length} CLB demo, ${result.removedTenantIds.length} tenant demo${
        result.strippedPlayers ? `, gỡ ${result.strippedPlayers} VĐV demo sót` : ""
      }. Auto-seed đã tắt.`,
    });
  };

  const handleDownloadBackup = () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    if (!backupAvailable) {
      setStatusMessage({ type: "error", text: "Vui lòng tạo backup trước khi tải xuống." });
      return;
    }

    const blob = new Blob([exportText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pickleball-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatusMessage({ type: "success", text: "File backup đã được tải xuống." });
  };

  const handleCopyExport = async () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    if (!backupAvailable) {
      setStatusMessage({ type: "error", text: "Không có dữ liệu để sao chép." });
      return;
    }

    try {
      await navigator.clipboard.writeText(exportText);
      setStatusMessage({ type: "success", text: "Đã sao chép JSON backup vào clipboard." });
    } catch {
      setStatusMessage({ type: "error", text: "Không thể sao chép. Vui lòng thử lại." });
    }
  };

  const handleImport = () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    try {
      const parsed = JSON.parse(importText);
      const payload = parsed.data || parsed;
      saveAIData(payload);
      setStatusMessage({ type: "success", text: "Nhập dữ liệu thành công." });
      setImportText("");
      setDataVersion((version) => version + 1);
    } catch {
      setStatusMessage({ type: "error", text: "Dữ liệu nhập không hợp lệ." });
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setImportText(content);
      setStatusMessage({ type: "success", text: "Đã nạp nội dung file. Bấm Nhập dữ liệu để restore." });
    };
    reader.onerror = () => {
      setStatusMessage({ type: "error", text: "Không thể đọc file backup." });
    };

    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  const handleCreateSnapshot = () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    const data = loadAIData(activeClubId);
    const nextSnapshots = [
      {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        summary: {
          sessions: data.sessions?.length || 0,
          players: Object.keys(data.history || {}).length,
          policies: data.policies?.length || 0,
          rules: data.rules?.length || 0,
        },
        backup: {
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        },
      },
      ...snapshots,
    ].slice(0, SNAPSHOT_CAP);

    setSnapshots(nextSnapshots);
    saveSnapshots(activeClubId, nextSnapshots);
    setStatusMessage({ type: "success", text: "Đã tạo snapshot backup." });
  };

  const handleRestoreSnapshot = (snapshotId) => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    const target = snapshots.find((item) => item.id === snapshotId);
    if (!target) {
      setStatusMessage({ type: "error", text: "Không tìm thấy snapshot để restore." });
      return;
    }

    saveAIData(target.backup?.data || {});
    setStatusMessage({ type: "success", text: "Restore snapshot thành công." });
    setDataVersion((version) => version + 1);
  };

  const handleDeleteSnapshot = (snapshotId) => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    const nextSnapshots = snapshots.filter((item) => item.id !== snapshotId);
    setSnapshots(nextSnapshots);
    saveSnapshots(activeClubId, nextSnapshots);
    setStatusMessage({ type: "success", text: "Đã xóa snapshot." });
  };

  const handleReset = () => {
    setConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    const result = resetAIData(activeClubId);
    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error });
      return;
    }
    setStatusMessage({ type: "success", text: "Đã xóa dữ liệu AI." });
    setExportText("");
    setImportText("");
    setDataVersion((version) => version + 1);
  };

  const handleSyncCloud = async () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    const result = await syncAIDataToCloud();

    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error || "Đồng bộ cloud thất bại." });
      return;
    }

    setStatusMessage({
      type: "success",
      text: `Đã đồng bộ cloud cho CLB ${result.clubId} lúc ${new Date(result.syncedAt).toLocaleString("vi-VN")}.`,
    });
  };

  const handlePullCloud = async () => {
    if (!accessAllowed) {
      setStatusMessage({ type: "error", text: "Runtime platform chặn thao tác cài đặt hệ thống." });
      return;
    }

    const result = await pullAIDataFromCloud();

    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error || "Không kéo được dữ liệu cloud." });
      return;
    }

    setDataVersion((version) => version + 1);
    setStatusMessage({
      type: "success",
      text: `Đã tải dữ liệu cloud cho CLB ${result.clubId}.`,
    });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
        ⚙️ Cài đặt
      </Typography>

      <Stack spacing={2}>
        {statusMessage && (
          <Alert severity={statusMessage.type}>{statusMessage.text}</Alert>
        )}

        {!isProductionBuild && <RbacDevPanel />}

        <VenueOnboardingPanel />

        <VenueStaffPanel />

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🧩 Core platform preview
            </Typography>
            {platformPreview ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  Trạng thái: {platformPreview.status === "error" ? "Lỗi" : platformPreview.status === "initialized" ? "Đã khởi tạo" : "Sẵn sàng"}
                </Typography>
                {platformPreview.message ? (
                  <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                    {platformPreview.message}
                  </Typography>
                ) : (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
                    <Chip size="small" label={`Tenant: ${platformPreview.tenantName || "—"}`} color="primary" />
                    <Chip size="small" label={`Plan: ${platformPreview.plan || "—"}`} />
                    <Chip size="small" label={`Mobile: ${platformPreview.mobileEnabled ? "on" : "off"}`} color={platformPreview.mobileEnabled ? "success" : "default"} />
                    <Chip size="small" label={`AI: ${platformPreview.aiEnabled ? "on" : "off"}`} color={platformPreview.aiEnabled ? "info" : "default"} />
                    <Chip size="small" label={`Access: ${platformPreview.access || "unknown"}`} color={platformPreview.access === "allowed" ? "success" : "warning"} />
                    {platformPreview.subscriptionStatus && (
                      <Chip size="small" label={`Subscription: ${platformPreview.subscriptionStatus}`} />
                    )}
                  </Stack>
                )}
              </>
            ) : (
              <Typography color="text.secondary">Đang khởi tạo preview platform v5…</Typography>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Đồng bộ cloud
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={cloudSyncMode === "supabase" ? "Supabase" : "Local (trình duyệt)"}
                color={cloudSyncMode === "supabase" ? "success" : "default"}
              />
              {isProductionBuild && cloudSyncMode !== "supabase" && (
                <Chip
                  size="small"
                  color="warning"
                  label="Chưa cấu hình Supabase trên Vercel"
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              CLB đang làm việc: {activeClub?.name}
              {lastCloudSync
                ? ` • Lần sync gần nhất: ${new Date(lastCloudSync).toLocaleString("vi-VN")}`
                : " • Chưa có bản sync local"}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button variant="contained" onClick={handleSyncCloud}>
                    Đồng bộ lên cloud
                  </Button>
                  <Button variant="outlined" onClick={handlePullCloud}>
                    Lấy dữ liệu từ cloud
                  </Button>
                </Stack>
              </PermissionGate>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Quản lý CLB, mùa và giải tại menu CLB & Giải.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              📦 Data health
            </Typography>
            <Grid container spacing={1}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Chip label={`Sessions: ${aiData.sessions?.length || 0}`} color="primary" />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Chip label={`History players: ${Object.keys(aiData.history || {}).length}`} color="success" />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Chip label={`Policies: ${aiData.policies?.length || 0}`} color="info" />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Chip label={`Rules: ${aiData.rules?.length || 0}`} color="warning" />
              </Grid>
            </Grid>
            {import.meta.env.DEV && (
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Tạo nhanh 4 CLB demo, mỗi CLB 60 vận động viên (tổng 240 VĐV).
                </Typography>
                <Button variant="outlined" onClick={() => setDemoSeedOpen(true)}>
                  Tạo demo: 4 CLB × 60 VĐV
                </Button>
              </Stack>
            )}
            <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Xóa CLB/tenant/VĐV demo (abc_pickleball VĐV, Future Arena, Elite Club, CLB Sài Gòn…)
                  và tắt auto-seed. Dữ liệu CLB thật không bị xóa.
                </Typography>
                <Button color="warning" variant="outlined" onClick={() => setDemoPurgeOpen(true)}>
                  Dọn dữ liệu demo
                </Button>
              </Stack>
            </PermissionGate>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              📤 Xuất dữ liệu AI (Backup)
            </Typography>
            <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <Button variant="contained" onClick={handleExport}>
                  Tạo backup
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleCopyExport}
                  disabled={!backupAvailable}
                >
                  Sao chép JSON
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleDownloadBackup}
                  disabled={!backupAvailable}
                >
                  Tải file JSON
                </Button>
              </Stack>
            </PermissionGate>
            <TextField
              fullWidth
              multiline
              minRows={6}
              value={exportText}
              onChange={(e) => setExportText(e.target.value)}
              sx={{ mt: 2 }}
              helperText={backupAvailable ? "Dữ liệu backup đã sẵn sàng." : "Nhấn Tạo backup để tạo JSON."}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              📥 Nhập dữ liệu AI (Restore)
            </Typography>
            <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <Button variant="outlined" component="label">
                  Chọn file backup JSON
                  <input type="file" hidden accept="application/json" onChange={handleImportFile} />
                </Button>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={6}
                label="Dán dữ liệu JSON"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <Button variant="contained" color="success" sx={{ mt: 2 }} onClick={handleImport}>
                Nhập dữ liệu
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              💾 Snapshot backup/restore
            </Typography>

            <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
              <Button variant="contained" onClick={handleCreateSnapshot} sx={{ mb: 2 }}>
                Tạo snapshot nhanh
              </Button>
            </PermissionGate>

            <Divider sx={{ mb: 2 }} />

            {snapshots.length === 0 ? (
              <Typography color="text.secondary">Chưa có snapshot nào.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {snapshots.map((snapshot) => (
                  <Card key={snapshot.id} variant="outlined">
                    <CardContent>
                      <Typography fontWeight="bold">
                        Snapshot {new Date(snapshot.createdAt).toLocaleString("vi-VN")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Sessions: {snapshot.summary?.sessions || 0} • Players: {snapshot.summary?.players || 0} • Policies: {snapshot.summary?.policies || 0} • Rules: {snapshot.summary?.rules || 0}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
                          <Button size="small" variant="contained" color="success" onClick={() => handleRestoreSnapshot(snapshot.id)}>
                            Restore
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteSnapshot(snapshot.id)}>
                            Xóa
                          </Button>
                        </PermissionGate>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🧹 Xóa dữ liệu AI
            </Typography>
            <PermissionGate permission={PERMISSIONS.SYSTEM_SETTING}>
              <Button variant="outlined" color="error" onClick={handleReset}>
                Xóa toàn bộ dữ liệu AI
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Xác nhận xóa dữ liệu</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Bạn có chắc muốn xóa toàn bộ dữ liệu AI? Hành động này không thể khôi phục.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Hủy</Button>
            <Button color="error" variant="contained" onClick={handleConfirmReset}>
              Xóa
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={demoSeedOpen} onClose={() => setDemoSeedOpen(false)}>
          <DialogTitle>Tạo dữ liệu demo CLB & VĐV</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Hệ thống sẽ tạo 4 câu lạc bộ, mỗi CLB 60 vận động viên (tổng 240 VĐV). Nếu CLB demo
              đã có, danh sách VĐV sẽ được thay mới.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDemoSeedOpen(false)}>Hủy</Button>
            <Button variant="contained" onClick={handleSeedDemoRoster}>
              Tạo dữ liệu
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={demoPurgeOpen} onClose={() => setDemoPurgeOpen(false)}>
          <DialogTitle>Dọn dữ liệu demo</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Xóa các CLB/tenant/VĐV demo (ABC Pickleball, Future Arena, Elite Club, CLB A/B/C và 4
              CLB roster demo). CLB thật của bạn sẽ giữ nguyên. Sau khi dọn, hệ thống không tự tạo
              lại dữ liệu demo khi tải trang.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDemoPurgeOpen(false)}>Hủy</Button>
            <Button color="warning" variant="contained" onClick={handlePurgeDemoSeed}>
              Dọn demo
            </Button>
          </DialogActions>
        </Dialog>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🧪 Debug summary
            </Typography>
            <Typography color="text.secondary">{debugSummary}</Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}