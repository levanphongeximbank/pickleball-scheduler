import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import RefereeQrDialog from "./RefereeQrDialog.jsx";
import {
  assignRefereeToMatch,
  buildRefereeUrl,
  buildWhatsAppRefereeUrl,
  copyRefereeShareText,
} from "../../tournament/engines/refereeEngine.js";

/**
 * Director referee dialog.
 *
 * Official / non-daily (`requireCanonicalIdentity`): fail-closed without
 * canonicalUserId; does NOT write blob before parent CORE-13 ACK.
 * Daily: legacy name/token path via assignRefereeToMatch.
 */
export default function RefereeAssignDialog({
  open,
  match,
  matchLabels,
  onClose,
  onAssign,
  existingReferee,
  roster = [],
  requireCanonicalIdentity = true,
  buildUrl = null,
}) {
  const resolveUrl = useCallback(
    (token) =>
      typeof buildUrl === "function" ? buildUrl(token) : buildRefereeUrl(token),
    [buildUrl]
  );
  const [name, setName] = useState("");
  const [selectedRosterEntry, setSelectedRosterEntry] = useState(null);
  const [url, setUrl] = useState("");
  const [refereeName, setRefereeName] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const activeRoster = roster.filter((entry) => entry.active !== false);
  const canonicalRoster = activeRoster.filter((entry) =>
    Boolean(String(entry.canonicalUserId || entry.refereeUserId || "").trim())
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setMessage(null);
    setError(null);
    setSaving(false);
    setQrOpen(false);

    const rosterItems = roster.filter((entry) => entry.active !== false);

    if (existingReferee?.token || existingReferee?.canonicalUserId) {
      setName(existingReferee.name || "");
      setRefereeName(existingReferee.name || "");
      setUrl(existingReferee.token ? resolveUrl(existingReferee.token) : "");
      setSelectedRosterEntry(
        rosterItems.find(
          (entry) =>
            String(entry.id) === String(existingReferee.rosterId) ||
            String(entry.canonicalUserId || "") ===
              String(existingReferee.canonicalUserId || "")
        ) || null
      );
      return;
    }

    setName("");
    setRefereeName("");
    setUrl("");
    setSelectedRosterEntry(null);
  }, [open, existingReferee, roster, resolveUrl]);

  const resolvedName = selectedRosterEntry?.name || name.trim();
  const canAssignCanonical = Boolean(
    String(selectedRosterEntry?.canonicalUserId || selectedRosterEntry?.refereeUserId || "").trim()
  );

  const handleAssign = async () => {
    if (!match) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    if (requireCanonicalIdentity) {
      if (!canAssignCanonical) {
        setSaving(false);
        setError("Trọng tài chưa có danh tính canonical để phân công.");
        return;
      }
      // No blob write before CORE-13 ACK — parent owns Official integration path.
      const result = await onAssign({
        match,
        rosterEntry: selectedRosterEntry,
        action: "assign",
        reason: "director-dialog-assign",
      });
      setSaving(false);
      if (!result?.ok) {
        setError(result?.error || "Không gán được trọng tài.");
        return;
      }
      setRefereeName(selectedRosterEntry.name || "");
      if (result.token) {
        setUrl(resolveUrl(result.token));
      }
      setMessage(
        result.core13
          ? "Đã phân công qua CORE-13. (Link QR legacy chỉ hiện khi có token tương thích.)"
          : "Đã gán trọng tài."
      );
      return;
    }

    if (!resolvedName) {
      setSaving(false);
      return;
    }

    const assigned = assignRefereeToMatch(match, resolvedName, {
      rosterId: selectedRosterEntry?.id || "",
      rosterEntry: selectedRosterEntry || null,
    });
    const result = await onAssign(assigned);

    setSaving(false);

    if (!result?.ok) {
      setError(result?.error || "Không gán được trọng tài.");
      return;
    }

    setRefereeName(assigned.referee.name);
    setUrl(resolveUrl(assigned.token));
    setMessage("Đã gán trọng tài. Gửi link hoặc QR bên dưới cho trọng tài.");
  };

  const sharePayload = {
    url,
    refereeName,
    matchLabels,
  };

  const handleCopy = async () => {
    const ok = await copyRefereeShareText(sharePayload);
    setMessage(ok ? "Đã copy link và thông tin trận." : "Không copy được — hãy copy thủ công.");
  };

  if (!match) {
    return null;
  }

  const titleA = matchLabels?.entryALabel || match.entryALabel || match.teamALabel || "Đội A";
  const titleB = matchLabels?.entryBLabel || match.entryBLabel || match.teamBLabel || "Đội B";
  const assignDisabled = saving || (requireCanonicalIdentity ? !canAssignCanonical : !resolvedName);

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>
          Trọng tài — {titleA} vs {titleB}
        </DialogTitle>
        <DialogContent>
          {message && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!url && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {requireCanonicalIdentity && (
                <Alert severity="info">
                  Phân công Official yêu cầu canonicalUserId. Không dùng tên hiển thị làm identity.
                </Alert>
              )}
              {(requireCanonicalIdentity ? canonicalRoster : activeRoster).length > 0 && (
                <Autocomplete
                  options={requireCanonicalIdentity ? canonicalRoster : activeRoster}
                  value={selectedRosterEntry}
                  onChange={(_, value) => {
                    setSelectedRosterEntry(value);
                    if (value?.name) {
                      setName(value.name);
                    }
                  }}
                  getOptionLabel={(option) =>
                    option.canonicalUserId
                      ? `${option.name || ""} (tài khoản)`
                      : option.name || ""
                  }
                  isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                  renderInput={(params) => (
                    <TextField {...params} label="Chọn từ danh sách" placeholder="Chọn trọng tài" />
                  )}
                />
              )}
              {!requireCanonicalIdentity && (
                <TextField
                  fullWidth
                  label={activeRoster.length > 0 ? "Hoặc nhập tên khác" : "Tên trọng tài"}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (selectedRosterEntry && event.target.value !== selectedRosterEntry.name) {
                      setSelectedRosterEntry(null);
                    }
                  }}
                  placeholder="VD: Anh Tuấn"
                />
              )}
            </Stack>
          )}

          {url && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Trọng tài mở link hoặc quét QR trên điện thoại để cập nhật điểm live:
              </Typography>
              <TextField fullWidth value={url} InputProps={{ readOnly: true }} size="small" />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Button onClick={onClose}>Đóng</Button>
          {!url && (
            <Button variant="contained" onClick={handleAssign} disabled={assignDisabled}>
              {requireCanonicalIdentity ? "Gán qua CORE-13" : "Gán & tạo link"}
            </Button>
          )}
          {url && (
            <>
              <Button startIcon={<QrCode2Icon />} onClick={() => setQrOpen(true)}>
                Hiện QR Code
              </Button>
              <Button startIcon={<ContentCopyIcon />} onClick={handleCopy}>
                Copy
              </Button>
              <Button
                component="a"
                href={buildWhatsAppRefereeUrl(sharePayload)}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<WhatsAppIcon />}
                color="success"
              >
                WhatsApp
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <RefereeQrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        sharePayload={sharePayload}
      />
    </>
  );
}
