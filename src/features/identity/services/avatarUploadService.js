import { getCurrentUser } from "../../../auth/authService.js";
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { updateSelfProfile } from "./selfProfileService.js";

export const AVATAR_BUCKET = "user-avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAvatarFile(file) {
  if (!file) {
    return { ok: false, error: "Không có file được chọn.", code: "NO_FILE" };
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.",
      code: "INVALID_TYPE",
    };
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: "Ảnh quá lớn. Tối đa 2 MB.",
      code: "FILE_TOO_LARGE",
    };
  }

  return { ok: true };
}

function getAvatarObjectPath(userId, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || "jpg";
  return `${userId}/avatar.${ext}`;
}

export async function uploadUserAvatar(file) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  const validation = validateAvatarFile(file);
  if (!validation.ok) {
    return validation;
  }

  if (!hasSupabaseConfig()) {
    return {
      ok: false,
      error: "Upload ảnh cần cấu hình Supabase. Bạn có thể dán URL ảnh thay thế.",
      code: "NO_SUPABASE",
    };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const objectPath = getAvatarObjectPath(user.id, file.type);

  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    return {
      ok: false,
      error: uploadError.message || "Không thể tải ảnh lên.",
      code: "UPLOAD_FAILED",
    };
  }

  const { data: urlData } = client.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  const publicUrl = urlData?.publicUrl || "";

  if (!publicUrl) {
    return { ok: false, error: "Không lấy được URL ảnh.", code: "URL_FAILED" };
  }

  const profileResult = await updateSelfProfile({ avatarUrl: publicUrl });
  if (!profileResult.ok) {
    return profileResult;
  }

  return {
    ok: true,
    avatarUrl: publicUrl,
    user: profileResult.user,
  };
}

export async function removeUserAvatar() {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (hasSupabaseConfig()) {
    const client = getSupabaseAuthClient();
    if (client) {
      const paths = AVATAR_ALLOWED_TYPES.map((mime) => getAvatarObjectPath(user.id, mime));
      await client.storage.from(AVATAR_BUCKET).remove(paths);
    }
  }

  const profileResult = await updateSelfProfile({ avatarUrl: "" });
  if (!profileResult.ok) {
    return profileResult;
  }

  return {
    ok: true,
    user: profileResult.user,
  };
}
