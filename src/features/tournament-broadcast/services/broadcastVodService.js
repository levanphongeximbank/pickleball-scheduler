import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";

export const BROADCAST_VOD_BUCKET = "tournament-broadcast-vods";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

export function buildBroadcastVodPath({ clubId, tournamentId, timestamp = new Date() }) {
  const safeClub = String(clubId || "club").replace(/[^\w-]/g, "_");
  const safeTournament = String(tournamentId || "tournament").replace(/[^\w-]/g, "_");
  const stamp = timestamp.toISOString().replace(/[:.]/g, "-");
  return `${safeClub}/${safeTournament}/trinh-chieu-${stamp}.webm`;
}

export function isBroadcastVodUploadAvailable() {
  return hasSupabaseConfig();
}

export async function uploadBroadcastVod({
  blob,
  clubId,
  tournamentId,
  tournamentName = "",
}) {
  if (!blob || blob.size <= 0) {
    return { ok: false, error: "Không có dữ liệu video để tải lên." };
  }

  if (!isBroadcastVodUploadAvailable()) {
    return { ok: false, error: "Chưa cấu hình Supabase." };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Không kết nối được Supabase." };
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user) {
    return { ok: false, error: "Cần đăng nhập để lưu VOD lên cloud." };
  }

  const objectPath = buildBroadcastVodPath({ clubId, tournamentId });
  const metadata = tournamentName ? { tournamentName } : undefined;

  const { error: uploadError } = await client.storage.from(BROADCAST_VOD_BUCKET).upload(objectPath, blob, {
    contentType: blob.type || "video/webm",
    upsert: false,
    metadata,
  });

  if (uploadError) {
    return { ok: false, error: uploadError.message || "Upload VOD thất bại." };
  }

  const { data: signedData, error: signedError } = await client.storage
    .from(BROADCAST_VOD_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SEC);

  if (signedError) {
    return {
      ok: true,
      path: objectPath,
      bucket: BROADCAST_VOD_BUCKET,
      signedUrl: null,
      warning: signedError.message,
    };
  }

  return {
    ok: true,
    path: objectPath,
    bucket: BROADCAST_VOD_BUCKET,
    signedUrl: signedData?.signedUrl || null,
  };
}
