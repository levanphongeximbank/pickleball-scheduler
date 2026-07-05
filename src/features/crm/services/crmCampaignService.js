const STORAGE_PREFIX = "pickleball-crm-campaigns-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
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

export function listCampaigns(clubId, { status } = {}) {
  let campaigns = readCampaigns(clubId);
  if (status) {
    campaigns = campaigns.filter((row) => row.status === status);
  }
  return campaigns.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createCampaign(clubId, payload = {}) {
  const campaigns = readCampaigns(clubId);
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
  writeCampaigns(clubId, campaigns);
  return campaign;
}

export function updateCampaign(clubId, campaignId, patch = {}) {
  const campaigns = readCampaigns(clubId);
  const index = campaigns.findIndex((row) => row.id === campaignId);
  if (index < 0) return null;

  campaigns[index] = {
    ...campaigns[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeCampaigns(clubId, campaigns);
  return campaigns[index];
}

export function launchCampaign(clubId, campaignId, { sentCount = 0 } = {}) {
  return updateCampaign(clubId, campaignId, {
    status: "completed",
    sentCount: Number(sentCount) || 0,
    launchedAt: new Date().toISOString(),
  });
}

export function deleteCampaign(clubId, campaignId) {
  const campaigns = readCampaigns(clubId).filter((row) => row.id !== campaignId);
  writeCampaigns(clubId, campaigns);
  return true;
}

export function clearCrmCampaigns(clubId) {
  localStorage.removeItem(storageKey(clubId));
}
