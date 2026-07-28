import { guardCrmLegacyLocalAccess } from "../runtime/resolveCrmLegacyRuntime.js";
import { CRM_LEGACY_ERROR_CODE } from "../runtime/constants.js";

const STORAGE_PREFIX = "pickleball-crm-campaigns-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
}

function blockedResult(gate) {
  return {
    ok: false,
    code: gate.code || CRM_LEGACY_ERROR_CODE.MUTATION_BLOCKED,
    error: gate.error || gate.code,
    legacyBlocked: true,
  };
}

function readCampaigns(clubId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCampaigns(clubId, campaigns) {
  localStorage.setItem(storageKey(clubId), JSON.stringify(campaigns));
}

function makeId() {
  return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listCampaignsResult(clubId, { status } = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return { ...blockedResult(gate), items: [] };

  let campaigns = readCampaigns(gate.clubId);
  if (status) campaigns = campaigns.filter((row) => row.status === status);
  campaigns.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { ok: true, items: campaigns };
}

export function listCampaigns(clubId, options = {}, env) {
  return listCampaignsResult(clubId, options, env).items;
}

export function createCampaign(clubId, payload = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const campaigns = readCampaigns(gate.clubId);
  const campaign = {
    id: makeId(),
    name: String(payload.name || "").trim() || "Chiến dịch mới",
    templateId: payload.templateId || null,
    targetGroup: String(payload.targetGroup || "all").trim(),
    status: payload.scheduledAt ? "scheduled" : "draft",
    scheduledAt: payload.scheduledAt || null,
    sentCount: 0,
    createdAt: new Date().toISOString(),
  };
  campaigns.push(campaign);
  writeCampaigns(gate.clubId, campaigns);
  return { ok: true, data: campaign };
}

export function updateCampaign(clubId, campaignId, patch = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const campaigns = readCampaigns(gate.clubId);
  const index = campaigns.findIndex((row) => row.id === campaignId);
  if (index < 0) {
    return { ok: false, code: "CRM_CAMPAIGN_NOT_FOUND", error: "Không tìm thấy chiến dịch." };
  }

  campaigns[index] = {
    ...campaigns[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeCampaigns(gate.clubId, campaigns);
  return { ok: true, data: campaigns[index] };
}

export function launchCampaign(clubId, campaignId, { sentCount = 0 } = {}, env) {
  return updateCampaign(
    clubId,
    campaignId,
    {
      status: "completed",
      sentCount: Number(sentCount) || 0,
      launchedAt: new Date().toISOString(),
    },
    env
  );
}

export function deleteCampaign(clubId, campaignId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  const campaigns = readCampaigns(gate.clubId).filter((row) => row.id !== campaignId);
  writeCampaigns(gate.clubId, campaigns);
  return { ok: true };
}

export function clearCrmCampaigns(clubId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  localStorage.removeItem(storageKey(gate.clubId));
  return { ok: true };
}
