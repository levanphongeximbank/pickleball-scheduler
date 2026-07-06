import { useCallback, useRef, useState } from "react";

const DEFAULT_MIME = "video/webm;codecs=vp9,opus";

function resolveRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function usePresentationCapture() {
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const onChunkRef = useRef(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCapture = useCallback(async ({ onChunk, preferCurrentTab = true } = {}) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      return { ok: false, error: "Trình duyệt không hỗ trợ quay màn hình." };
    }

    if (typeof MediaRecorder === "undefined") {
      return { ok: false, error: "Trình duyệt không hỗ trợ MediaRecorder." };
    }

    const mimeType = resolveRecorderMimeType();
    if (!mimeType) {
      return { ok: false, error: "Không tìm thấy codec video phù hợp." };
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: preferCurrentTab ? "browser" : undefined,
          frameRate: 30,
        },
        audio: false,
        preferCurrentTab,
      });

      streamRef.current = stream;
      chunksRef.current = [];
      onChunkRef.current = onChunk || null;

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size <= 0) {
          return;
        }

        chunksRef.current.push(event.data);
        onChunkRef.current?.(event.data);
      };

      recorder.onstop = () => {
        stopTracks();
        setCapturing(false);
      };

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      });

      recorder.start(2000);
      setCapturing(true);
      return { ok: true, mimeType };
    } catch (error) {
      stopTracks();
      setCapturing(false);
      return { ok: false, error: error?.message || "Không bắt đầu được quay màn hình." };
    }
  }, [stopTracks]);

  const stopCapture = useCallback(async () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise((resolve) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.stop();
      });
    } else {
      stopTracks();
      setCapturing(false);
    }

    const mimeType = resolveRecorderMimeType() || "video/webm";
    const blob =
      chunksRef.current.length > 0
        ? new Blob(chunksRef.current, { type: mimeType })
        : null;

    recorderRef.current = null;
    chunksRef.current = [];

    return { blob, mimeType };
  }, [stopTracks]);

  return {
    capturing,
    startCapture,
    stopCapture,
  };
}

export { DEFAULT_MIME };
