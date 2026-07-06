/**
 * Dev relay server — nhận chunk WebM từ app, ghép file và đẩy RTMP (YouTube/Facebook).
 *
 * Usage:
 *   node scripts/broadcast-relay.mjs
 *   VITE_BROADCAST_RELAY_URL=http://localhost:8787 npm run dev
 *
 * Requires: ffmpeg in PATH
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.BROADCAST_RELAY_PORT || 8787);
const HOST = process.env.BROADCAST_RELAY_HOST || "127.0.0.1";
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".broadcast-relay-data");

/** @type {Map<string, { meta: object, chunks: Buffer[], ended: boolean }>} */
const sessions = new Map();

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function buildFfmpegArgs(inputPath, destinations) {
  if (destinations.length === 1) {
    const dest = destinations[0];
    return [
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-f",
      "flv",
      `${dest.rtmpUrl.replace(/\/$/, "")}/${dest.streamKey}`,
    ];
  }

  const teeTargets = destinations
    .map((dest) => `[f=flv:onfail=ignore]${dest.rtmpUrl.replace(/\/$/, "")}/${dest.streamKey}`)
    .join("|");

  return ["-y", "-i", inputPath, "-c", "copy", "-f", "tee", teeTargets];
}

async function finalizeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || session.finalizing) {
    return { ok: false, error: "Session không tồn tại." };
  }

  session.finalizing = true;
  const inputPath = path.join(DATA_DIR, `${sessionId}.webm`);
  await writeFile(inputPath, Buffer.concat(session.chunks));

  const destinations = session.meta?.destinations || [];
  if (!destinations.length) {
    sessions.delete(sessionId);
    return { ok: true, vodPath: inputPath, relayed: false };
  }

  return new Promise((resolve) => {
    const args = buildFfmpegArgs(inputPath, destinations);
    const ffmpeg = spawn("ffmpeg", args, { stdio: "inherit" });

    ffmpeg.on("close", (code) => {
      sessions.delete(sessionId);
      resolve({
        ok: code === 0,
        vodPath: inputPath,
        relayed: code === 0,
        exitCode: code,
      });
    });

    ffmpeg.on("error", (error) => {
      sessions.delete(sessionId);
      resolve({ ok: false, error: error.message, vodPath: inputPath });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, sessions: sessions.size });
    return;
  }

  if (req.method === "POST" && url.pathname === "/sessions") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessions.set(sessionId, {
      meta: body,
      chunks: [],
      ended: false,
      finalizing: false,
    });
    sendJson(res, 201, { sessionId });
    return;
  }

  const chunkMatch = url.pathname.match(/^\/sessions\/([^/]+)\/chunks$/);
  if (req.method === "POST" && chunkMatch) {
    const sessionId = decodeURIComponent(chunkMatch[1]);
    const session = sessions.get(sessionId);
    if (!session) {
      sendJson(res, 404, { error: "Session not found" });
      return;
    }

    const chunk = await readBody(req);
    session.chunks.push(chunk);
    sendJson(res, 200, { ok: true, bytes: chunk.length });
    return;
  }

  const endMatch = url.pathname.match(/^\/sessions\/([^/]+)\/end$/);
  if (req.method === "POST" && endMatch) {
    const sessionId = decodeURIComponent(endMatch[1]);
    const session = sessions.get(sessionId);
    if (!session) {
      sendJson(res, 404, { error: "Session not found" });
      return;
    }

    session.ended = true;
    const result = await finalizeSession(sessionId);
    sendJson(res, result.ok ? 200 : 500, result);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

await ensureDataDir();

server.listen(PORT, HOST, () => {
  console.log(`Broadcast relay listening on http://${HOST}:${PORT}`);
});
