/**
 * Canonical MLP4 lineup slot contract + client-side discipline metadata repair.
 *
 * Staging/cloud rows (and captain-portal payloads that omit gender fields) may
 * arrive as genderRequirement=any. Validator + Select eligibility require the
 * preset contract from createMlpDisciplines() without weakening validation.
 */

import {
  ACTIVATION_RULE,
  DISCIPLINE_CATEGORY,
  DISCIPLINE_KIND,
  FORMAT_PRESET,
  GENDER_REQUIREMENT,
} from "../constants.js";
import {
  ensureCanonicalMlpDisciplines,
  getActiveMatchDisciplines,
  isMlpFormat,
} from "./mlpPresetEngine.js";

/** @typedef {{ genderRequirement: string, categoryType: string, slotRole: string }} MlpSlotSpec */

export const MLP4_SLOT_CONTRACT = Object.freeze({
  roster: Object.freeze({ males: 2, females: 2, total: 4 }),
  subMatchesPerTie: 4,
  participationPerAthlete: Object.freeze({
    total: 2,
    sameGender: 1,
    mixed: 1,
  }),
  /** Active doubles order (excludes Dreambreaker). */
  slots: Object.freeze([
    Object.freeze({
      slotRole: "female_doubles",
      genderRequirement: GENDER_REQUIREMENT.FEMALE,
      categoryType: DISCIPLINE_CATEGORY.DOUBLES,
      playerCount: 2,
      positionGenders: Object.freeze(["female", "female"]),
    }),
    Object.freeze({
      slotRole: "male_doubles",
      genderRequirement: GENDER_REQUIREMENT.MALE,
      categoryType: DISCIPLINE_CATEGORY.DOUBLES,
      playerCount: 2,
      positionGenders: Object.freeze(["male", "male"]),
    }),
    Object.freeze({
      slotRole: "mixed_1",
      genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
      categoryType: DISCIPLINE_CATEGORY.MIXED,
      playerCount: 2,
      positionGenders: Object.freeze(["male", "female"]),
    }),
    Object.freeze({
      slotRole: "mixed_2",
      genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
      categoryType: DISCIPLINE_CATEGORY.MIXED,
      playerCount: 2,
      positionGenders: Object.freeze(["male", "female"]),
    }),
  ]),
});

function normalizeName(value) {
  return String(value || "")
    .normalize("NFC")
    .toLowerCase()
    .trim();
}

function isDreambreakerDiscipline(discipline) {
  return (
    discipline?.disciplineKind === DISCIPLINE_KIND.DREAMBREAKER ||
    discipline?.activationRule === ACTIVATION_RULE.TIE_AT_2_2
  );
}

function hasCanonicalGenderRequirement(value) {
  return (
    value === GENDER_REQUIREMENT.MALE ||
    value === GENDER_REQUIREMENT.FEMALE ||
    value === GENDER_REQUIREMENT.MIXED_PAIR
  );
}

/**
 * Infer MLP slot role from Vietnamese/English discipline name.
 * @param {object} discipline
 * @returns {string|null}
 */
export function inferMlpSlotRoleFromName(discipline) {
  const name = normalizeName(discipline?.name);
  if (!name) return null;
  if (/dream|tie.?break|lu[aâ]n\s*l[uư]u/.test(name)) return null;
  // Mixed before single-gender (e.g. "Đôi nam nữ").
  if (/nam\s*nữ|nam nữ|mixed|nam\/nữ|nam-nữ/.test(name)) {
    return "mixed";
  }
  if (/nữ|female|women|ladies/.test(name)) return "female_doubles";
  if (/nam|male|men/.test(name)) return "male_doubles";
  return null;
}

/**
 * @param {object[]} activeDisciplines
 * @returns {Map<string, MlpSlotSpec>}
 */
function buildActiveDisciplineSlotSpecs(activeDisciplines = []) {
  const specs = new Map();
  const contractSlots = MLP4_SLOT_CONTRACT.slots;
  const mixedQueue = contractSlots.filter((s) => s.slotRole.startsWith("mixed"));
  let mixedIndex = 0;
  let assignedFemale = false;
  let assignedMale = false;

  const sorted = [...activeDisciplines].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );

  for (const discipline of sorted) {
    const id = String(discipline?.id || "").trim();
    if (!id) continue;

    const role = inferMlpSlotRoleFromName(discipline);
    if (role === "female_doubles" && !assignedFemale) {
      specs.set(id, contractSlots[0]);
      assignedFemale = true;
      continue;
    }
    if (role === "male_doubles" && !assignedMale) {
      specs.set(id, contractSlots[1]);
      assignedMale = true;
      continue;
    }
    if (role === "mixed" && mixedIndex < mixedQueue.length) {
      specs.set(id, mixedQueue[mixedIndex]);
      mixedIndex += 1;
      continue;
    }
  }

  // Fill remaining active disciplines by canonical sort order (female→male→mixed×2).
  const remainingSpecs = contractSlots.filter((spec) => {
    for (const assigned of specs.values()) {
      if (assigned.slotRole === spec.slotRole) return false;
    }
    return true;
  });
  let remainingIdx = 0;
  for (const discipline of sorted) {
    const id = String(discipline?.id || "").trim();
    if (!id || specs.has(id)) continue;
    if (remainingIdx >= remainingSpecs.length) break;
    specs.set(id, remainingSpecs[remainingIdx]);
    remainingIdx += 1;
  }

  return specs;
}

/**
 * Repair MLP4 discipline gender/category metadata for client eligibility + validation.
 * Does not invent new discipline rows; only corrects metadata on existing actives.
 *
 * @param {object[]} disciplines
 * @returns {object[]}
 */
export function repairMlpDisciplineSlotMetadata(disciplines = []) {
  const list = Array.isArray(disciplines) ? disciplines : [];
  const active = getActiveMatchDisciplines(list);
  const specs = buildActiveDisciplineSlotSpecs(active);

  return list.map((discipline) => {
    if (!discipline || isDreambreakerDiscipline(discipline)) {
      return discipline;
    }
    const id = String(discipline.id || "").trim();
    const spec = specs.get(id);
    if (!spec) {
      return discipline;
    }
    const alreadyCanonical =
      hasCanonicalGenderRequirement(discipline.genderRequirement) &&
      (discipline.genderRequirement !== GENDER_REQUIREMENT.MIXED_PAIR ||
        discipline.categoryType === DISCIPLINE_CATEGORY.MIXED);
    if (
      alreadyCanonical &&
      discipline.genderRequirement === spec.genderRequirement &&
      (spec.categoryType === DISCIPLINE_CATEGORY.MIXED
        ? discipline.categoryType === DISCIPLINE_CATEGORY.MIXED
        : true)
    ) {
      return {
        ...discipline,
        genderRequirement: spec.genderRequirement,
        categoryType: spec.categoryType,
        slotRole: spec.slotRole,
        activationRule: discipline.activationRule || ACTIVATION_RULE.ALWAYS,
      };
    }
    return {
      ...discipline,
      genderRequirement: spec.genderRequirement,
      categoryType: spec.categoryType,
      slotRole: spec.slotRole,
      activationRule: discipline.activationRule || ACTIVATION_RULE.ALWAYS,
    };
  });
}

/**
 * @param {object|null|undefined} teamData
 * @returns {object|null|undefined}
 */
export function applyCanonicalMlpDisciplineMetadata(teamData) {
  if (!teamData || typeof teamData !== "object") {
    return teamData;
  }
  const disciplines = teamData.disciplines || [];
  const looksMlp =
    isMlpFormat(teamData) ||
    teamData.settings?.formatPreset === FORMAT_PRESET.MLP_4 ||
    looksLikeMlpDisciplineSet(disciplines);
  if (!looksMlp) {
    return teamData;
  }
  return {
    ...teamData,
    settings: {
      ...(teamData.settings || {}),
      formatPreset: teamData.settings?.formatPreset || FORMAT_PRESET.MLP_4,
      dreambreakerEnabled: teamData.settings?.dreambreakerEnabled !== false,
    },
    disciplines: repairMlpDisciplineSlotMetadata(
      ensureCanonicalMlpDisciplines(disciplines, {
        ...teamData,
        settings: {
          ...(teamData.settings || {}),
          formatPreset: teamData.settings?.formatPreset || FORMAT_PRESET.MLP_4,
        },
      })
    ),
  };
}

function looksLikeMlpDisciplineSet(disciplines = []) {
  const active = getActiveMatchDisciplines(disciplines);
  if (active.length < 4) return false;
  const roles = active.map((discipline) => inferMlpSlotRoleFromName(discipline));
  const recognized = roles.filter(Boolean).length;
  return recognized >= 3;
}

/**
 * Position-level gender gate for a Select slot.
 * Mixed pair: index 0 = male, index 1 = female.
 *
 * @param {object|null|undefined} discipline
 * @param {number|null|undefined} slotIndex
 * @returns {"male"|"female"|null}
 */
export function resolveMlpSlotGenderGate(discipline, slotIndex = null) {
  if (!discipline) return null;
  const req = discipline.genderRequirement;
  if (req === GENDER_REQUIREMENT.MALE) return "male";
  if (req === GENDER_REQUIREMENT.FEMALE) return "female";
  if (req === GENDER_REQUIREMENT.MIXED_PAIR) {
    if (slotIndex == null || Number.isNaN(Number(slotIndex))) {
      return null;
    }
    return Number(slotIndex) === 0 ? "male" : "female";
  }
  return null;
}

/**
 * Count same-gender vs mixed appearances for MLP participation checks (tests).
 * @param {object} teamData
 * @param {Record<string, string[]>} selections
 */
export function summarizeMlpParticipation(teamData, selections = {}) {
  const active = getActiveMatchDisciplines(teamData?.disciplines || []);
  const byPlayer = new Map();

  for (const discipline of active) {
    const ids = selections[discipline.id] || [];
    const kind =
      discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
        ? "mixed"
        : "sameGender";
    for (const rawId of ids) {
      const id = String(rawId || "").trim();
      if (!id) continue;
      const row = byPlayer.get(id) || { total: 0, sameGender: 0, mixed: 0 };
      row.total += 1;
      row[kind] += 1;
      byPlayer.set(id, row);
    }
  }

  return byPlayer;
}
