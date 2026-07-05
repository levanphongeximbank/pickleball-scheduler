const STORAGE_PREFIX = "pickleball-customer-groups-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
}

function readGroups(clubId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGroups(clubId, groups) {
  localStorage.setItem(storageKey(clubId), JSON.stringify(groups));
}

export function listCustomerGroups(clubId) {
  return readGroups(clubId);
}

export function createCustomerGroup(clubId, { name, description = "", memberIds = [] } = {}) {
  const groups = readGroups(clubId);
  const group = {
    id: `cg-${Date.now()}`,
    name: String(name || "").trim(),
    description: String(description || "").trim(),
    memberIds: [...memberIds],
    createdAt: new Date().toISOString(),
  };
  groups.push(group);
  writeGroups(clubId, groups);
  return group;
}

export function updateCustomerGroup(clubId, groupId, patch = {}) {
  const groups = readGroups(clubId);
  const index = groups.findIndex((g) => g.id === groupId);
  if (index < 0) return null;
  groups[index] = { ...groups[index], ...patch, updatedAt: new Date().toISOString() };
  writeGroups(clubId, groups);
  return groups[index];
}

export function deleteCustomerGroup(clubId, groupId) {
  const groups = readGroups(clubId).filter((g) => g.id !== groupId);
  writeGroups(clubId, groups);
  return true;
}
