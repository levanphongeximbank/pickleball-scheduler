/*
==================================================
Director Mode
Policy Engine
==================================================
*/

import { loadAIData, saveAIData } from "./storage.js";
import { assertExplicitClubId } from "../features/club/context/requireExplicitClubId.js";

function getData(clubId) {
  const resolvedClubId = assertExplicitClubId(clubId);
  const data = loadAIData(resolvedClubId);

  if (!data.policies) {
    data.policies = [];
  }

  if (!data.rules) {
    data.rules = [];
  }

  return { data, clubId: resolvedClubId };
}

export function getPolicies(clubId) {
  return getData(clubId).data.policies;
}

export function addPolicy(policy, clubId) {
  const { data, clubId: resolvedClubId } = getData(clubId);

  data.policies.push({
    id: Date.now(),
    enabled: true,
    priority: "HIGH",
    once: true,
    ...policy,
  });

  saveAIData(data, resolvedClubId);
}

export function removePolicy(id, clubId) {
  const { data, clubId: resolvedClubId } = getData(clubId);

  data.policies = data.policies.filter((p) => p.id !== id);

  saveAIData(data, resolvedClubId);
}

export function togglePolicy(id, clubId) {
  const { data, clubId: resolvedClubId } = getData(clubId);

  const policy = data.policies.find((p) => p.id === id);

  if (policy) {
    policy.enabled = !policy.enabled;
  }

  saveAIData(data, resolvedClubId);
}

export function addTestPolicy(playerA, playerB, clubId) {
  addPolicy(
    {
      type: "prefer_teammate",
      playerA,
      playerB,
      priority: "HIGH",
    },
    clubId
  );
}

export function getRules(clubId) {
  return getData(clubId).data.rules;
}

export function addRule(rule, clubId) {
  const { data, clubId: resolvedClubId } = getData(clubId);

  data.rules.push({
    id: Date.now(),
    enabled: true,
    ...rule,
  });

  saveAIData(data, resolvedClubId);
}

export function removeRule(id, clubId) {
  const { data, clubId: resolvedClubId } = getData(clubId);

  data.rules = data.rules.filter((p) => p.id !== id);

  saveAIData(data, resolvedClubId);
}

export function toggleRule(id, clubId) {
  const { data, clubId: resolvedClubId } = getData(clubId);

  const rule = data.rules.find((p) => p.id === id);

  if (rule) {
    rule.enabled = !rule.enabled;
  }

  saveAIData(data, resolvedClubId);
}
