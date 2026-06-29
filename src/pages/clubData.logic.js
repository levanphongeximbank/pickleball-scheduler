import { normalizeCourts } from "../models/court.js";
import { normalizePlayers } from "../models/player.js";

export const CLUB_DATA_SCHEMA_VERSION = 3;

function parseJson(raw) {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }

  return raw;
}

export function buildPlayersExportPayload(players = [], clubId = null) {
  return {
    schemaVersion: CLUB_DATA_SCHEMA_VERSION,
    type: "players",
    exportedAt: new Date().toISOString(),
    clubId,
    items: normalizePlayers(players),
  };
}

export function buildCourtsExportPayload(courts = [], clubId = null) {
  return {
    schemaVersion: CLUB_DATA_SCHEMA_VERSION,
    type: "courts",
    exportedAt: new Date().toISOString(),
    clubId,
    items: normalizeCourts(courts),
  };
}

export function stringifyClubDataExport(payload) {
  return JSON.stringify(payload, null, 2);
}

export function buildFullClubExportPayload(clubId = null, data = null) {
  return {
    schemaVersion: CLUB_DATA_SCHEMA_VERSION,
    type: "club-full",
    exportedAt: new Date().toISOString(),
    clubId,
    data,
  };
}

export function parseClubDataImport(raw) {
  try {
    const parsed = parseJson(raw);

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Dữ liệu import không hợp lệ." };
    }

    if (!["players", "courts", "club-full"].includes(parsed.type)) {
      return { ok: false, error: "File import phải có type players, courts hoặc club-full." };
    }

    if (parsed.type === "club-full") {
      if (!parsed.data || typeof parsed.data !== "object") {
        return { ok: false, error: "File club-full thiếu data." };
      }

      return {
        ok: true,
        type: parsed.type,
        data: parsed.data,
        schemaVersion: parsed.schemaVersion || CLUB_DATA_SCHEMA_VERSION,
        exportedAt: parsed.exportedAt || null,
        clubId: parsed.clubId || null,
      };
    }

    if (!Array.isArray(parsed.items)) {
      return { ok: false, error: "File import thiếu danh sách items." };
    }

    return {
      ok: true,
      type: parsed.type,
      items: parsed.items,
      schemaVersion: parsed.schemaVersion || 1,
      exportedAt: parsed.exportedAt || null,
      clubId: parsed.clubId || null,
    };
  } catch {
    return { ok: false, error: "Không đọc được JSON import." };
  }
}

export function mergeImportedPlayers(existing = [], imported = [], options = {}) {
  const mode = options.mode || "merge";
  const normalizedImported = normalizePlayers(imported);

  if (mode === "replace") {
    return normalizedImported;
  }

  const byId = new Map(existing.map((player) => [player.id, player]));

  normalizedImported.forEach((player, index) => {
    if (byId.has(player.id)) {
      byId.set(player.id, {
        ...byId.get(player.id),
        ...player,
      });
      return;
    }

    byId.set(player.id ?? `import-${Date.now()}-${index}`, player);
  });

  return normalizePlayers(Array.from(byId.values()));
}

export function mergeImportedCourts(existing = [], imported = [], options = {}) {
  const mode = options.mode || "merge";
  const normalizedImported = normalizeCourts(imported);

  if (mode === "replace") {
    return normalizedImported;
  }

  const byId = new Map(existing.map((court) => [court.id, court]));

  normalizedImported.forEach((court, index) => {
    if (byId.has(court.id)) {
      byId.set(court.id, {
        ...byId.get(court.id),
        ...court,
      });
      return;
    }

    byId.set(court.id ?? Date.now() + index, court);
  });

  return normalizeCourts(Array.from(byId.values()));
}

export function importClubData(raw, { existingPlayers = [], existingCourts = [], expectedType, mode = "merge" } = {}) {
  const parsed = parseClubDataImport(raw);

  if (!parsed.ok) {
    return parsed;
  }

  if (expectedType && parsed.type !== expectedType) {
    return {
      ok: false,
      error: `File import không đúng loại. Cần ${expectedType}, nhận ${parsed.type}.`,
    };
  }

  if (parsed.type === "players") {
    return {
      ok: true,
      type: "players",
      items: mergeImportedPlayers(existingPlayers, parsed.items, { mode }),
    };
  }

  return {
    ok: true,
    type: "courts",
    items: mergeImportedCourts(existingCourts, parsed.items, { mode }),
  };
}
