/*
==================================================
Director Mode
Policy Engine
==================================================
*/

import { loadAIData, saveAIData } from "./storage.js";

function getData() {

    const data = loadAIData();

    if (!data.policies) {

        data.policies = [];

    }

    if (!data.rules) {

        data.rules = [];

    }

    return data;

}

/*
========================================
Lấy toàn bộ Policy
========================================
*/

export function getPolicies() {

    return getData().policies;

}

/*
========================================
Thêm Policy
========================================
*/

export function addPolicy(policy) {

    const data = getData();

    data.policies.push({

        id: Date.now(),

        enabled: true,

        priority: "HIGH",

        once: true,

        ...policy,

    });

    saveAIData(data);

}

/*
========================================
Xóa Policy
========================================
*/

export function removePolicy(id) {

    const data = getData();

    data.policies =
        data.policies.filter(p => p.id !== id);

    saveAIData(data);

}

/*
========================================
Bật / Tắt
========================================
*/

export function togglePolicy(id) {

    const data = getData();

    const policy =
        data.policies.find(p => p.id === id);

    if (policy) {

        policy.enabled = !policy.enabled;

    }

    saveAIData(data);

}
export function addTestPolicy(playerA, playerB) {
  addPolicy({
    type: "prefer_teammate",
    playerA,
    playerB,
    priority: "HIGH",
  });
}

/*
========================================
Rules tùy chỉnh CLB
========================================
*/

export function getRules() {

    return getData().rules;

}

export function addRule(rule) {

    const data = getData();

    data.rules.push({

        id: Date.now(),

        enabled: true,

        ...rule,

    });

    saveAIData(data);

}

export function removeRule(id) {

    const data = getData();

    data.rules =
        data.rules.filter(r => r.id !== id);

    saveAIData(data);

}

export function toggleRule(id) {

    const data = getData();

    const rule =
        data.rules.find(r => r.id === id);

    if (rule) {

        rule.enabled = !rule.enabled;

    }

    saveAIData(data);

}