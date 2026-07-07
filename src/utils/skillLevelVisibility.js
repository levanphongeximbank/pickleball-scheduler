import { getPlayerSkillLevel } from "../models/player.js";

export function formatOrganizerPlayerMeta(player, canViewSkillLevel) {
  const gender = player.gender || "?";
  if (!canViewSkillLevel) {
    return gender;
  }

  const skill = getPlayerSkillLevel(player);
  return `${gender} • Trình độ ${Number(skill).toFixed(1)}`;
}

export function formatOrganizerSkillOnly(player, canViewSkillLevel) {
  if (!canViewSkillLevel) {
    return null;
  }

  const skill = getPlayerSkillLevel(player);
  return `Trình độ ${Number(skill).toFixed(1)}`;
}
