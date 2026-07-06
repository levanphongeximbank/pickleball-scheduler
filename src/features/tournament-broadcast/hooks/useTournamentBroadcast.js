import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BROADCAST_STATUS } from "../constants/broadcastConfig.js";
import {
  appendRelayChunk,
  createRelaySession,
  endRelaySession,
  isRelayAvailable,
} from "../lib/broadcastRelayClient.js";
import {
  getActiveDestinations,
  isBroadcastConfigured,
  loadBroadcastConfig,
  saveBroadcastConfig,
} from "../services/broadcastConfigStorage.js";
import { usePresentationCapture } from "./usePresentationCapture.js";
import {
  isBroadcastVodUploadAvailable,
  uploadBroadcastVod,
} from "../services/broadcastVodService.js";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useTournamentBroadcast({ tournamentId, tournamentName, clubId }) {
  const capture = usePresentationCapture();
  const [status, setStatus] = useState(BROADCAST_STATUS.IDLE);
  const [error, setError] = useState(null);
  const [lastVodUpload, setLastVodUpload] = useState(null);
  const [config, setConfig] = useState(() => loadBroadcastConfig(tournamentId));
  const sessionIdRef = useRef(null);

  useEffect(() => {
    setConfig(loadBroadcastConfig(tournamentId));
  }, [tournamentId]);

  const relayAvailable = isRelayAvailable();
  const cloudVodAvailable = isBroadcastVodUploadAvailable();
  const configured = useMemo(() => isBroadcastConfigured(config), [config]);
  const activeDestinations = useMemo(() => getActiveDestinations(config), [config]);

  const updateConfig = useCallback(
    (nextConfig) => {
      setConfig(nextConfig);
      saveBroadcastConfig(tournamentId, nextConfig);
    },
    [tournamentId]
  );

  const stopBroadcast = useCallback(async () => {
    setStatus(BROADCAST_STATUS.STOPPING);
    setError(null);
    setLastVodUpload(null);

    const { blob } = await capture.stopCapture();
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    if (sessionId && relayAvailable) {
      const endResult = await endRelaySession(sessionId);
      if (!endResult.ok) {
        setError(endResult.error);
      }
    }

    if (config.saveLocalVod && blob && blob.size > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `trinh-chieu-${tournamentId || "giai"}-${stamp}.webm`);
    }

    let vodUpload = null;

    if (config.saveCloudVod && blob && blob.size > 0) {
      setStatus(BROADCAST_STATUS.UPLOADING);
      vodUpload = await uploadBroadcastVod({
        blob,
        clubId,
        tournamentId,
        tournamentName,
      });

      if (!vodUpload.ok) {
        setError(vodUpload.error);
        setStatus(BROADCAST_STATUS.ERROR);
        return { ok: false, error: vodUpload.error, vodUpload };
      }

      setLastVodUpload(vodUpload);
      if (vodUpload.signedUrl) {
        try {
          await navigator.clipboard.writeText(vodUpload.signedUrl);
        } catch {
          // Clipboard optional
        }
      }
    }

    setStatus(BROADCAST_STATUS.IDLE);
    return { ok: true, vodUpload };
  }, [capture, clubId, config.saveCloudVod, config.saveLocalVod, relayAvailable, tournamentId, tournamentName]);

  const startBroadcast = useCallback(async () => {
    if (!configured && !config.saveLocalVod && !config.saveCloudVod) {
      return { ok: true, skipped: true };
    }

    setStatus(BROADCAST_STATUS.PREPARING);
    setError(null);

    if (configured && relayAvailable) {
      const sessionResult = await createRelaySession({
        tournamentId,
        tournamentName,
        destinations: activeDestinations,
      });

      if (!sessionResult.ok) {
        setStatus(BROADCAST_STATUS.ERROR);
        setError(sessionResult.error);
        return sessionResult;
      }

      sessionIdRef.current = sessionResult.sessionId;
    } else if (configured && !relayAvailable) {
      setError("Phát live cần relay server — bỏ chọn YouTube/Facebook nếu chỉ ghi VOD cloud.");
    }

    const captureResult = await capture.startCapture({
      preferCurrentTab: true,
      onChunk: async (chunk) => {
        const sessionId = sessionIdRef.current;
        if (!sessionId || !relayAvailable) {
          return;
        }

        const upload = await appendRelayChunk(sessionId, chunk);
        if (!upload.ok) {
          setError(upload.error);
        }
      },
    });

    if (!captureResult.ok) {
      sessionIdRef.current = null;
      setStatus(BROADCAST_STATUS.ERROR);
      setError(captureResult.error);
      return captureResult;
    }

    setStatus(BROADCAST_STATUS.LIVE);
    return { ok: true };
  }, [
    activeDestinations,
    capture,
    config.saveLocalVod,
    config.saveCloudVod,
    configured,
    relayAvailable,
    tournamentId,
    tournamentName,
  ]);

  const shouldBroadcastWithFlow =
    config.autoBroadcastOnFlow &&
    (configured || config.saveLocalVod || config.saveCloudVod);

  return {
    status,
    error,
    config,
    updateConfig,
    configured,
    relayAvailable,
    cloudVodAvailable,
    capturing: capture.capturing,
    lastVodUpload,
    clearLastVodUpload: () => setLastVodUpload(null),
    shouldBroadcastWithFlow,
    startBroadcast,
    stopBroadcast,
    isLive: status === BROADCAST_STATUS.LIVE,
  };
}
