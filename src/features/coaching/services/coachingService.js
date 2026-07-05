const STORAGE_KEY_PREFIX = "pickleball-coaching-v1";

function storageKey(clubId) {
  return `${STORAGE_KEY_PREFIX}::${String(clubId || "").trim()}`;
}

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function emptyStore(clubId) {
  return {
    clubId: String(clubId || ""),
    coaches: [],
    students: [],
    classes: [],
    schedule: [],
    packages: [],
    attendance: [],
    evaluations: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadCoachingStore(clubId) {
  const id = String(clubId || "").trim();
  if (!id) return emptyStore("");
  const parsed = safeParse(localStorage.getItem(storageKey(id)), emptyStore(id));
  return {
    ...emptyStore(id),
    ...parsed,
    clubId: id,
    coaches: parsed.coaches || [],
    students: parsed.students || [],
    classes: parsed.classes || [],
    schedule: parsed.schedule || [],
    packages: parsed.packages || [],
    attendance: parsed.attendance || [],
    evaluations: parsed.evaluations || [],
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

export function saveCoachingStore(clubId, store) {
  const id = String(clubId || "").trim();
  if (!id) return { ok: false, error: "clubId không hợp lệ." };
  const payload = {
    ...store,
    clubId: id,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(id), JSON.stringify(payload));
  return { ok: true, store: payload };
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function upsertCollection(store, collectionKey, item, idPrefix) {
  const items = [...(store[collectionKey] || [])];
  const normalized = {
    ...item,
    id: item.id || nextId(idPrefix),
    updatedAt: new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString(),
  };
  const index = items.findIndex((row) => String(row.id) === String(normalized.id));
  if (index >= 0) items[index] = normalized;
  else items.push(normalized);
  return saveCoachingStore(store.clubId, { ...store, [collectionKey]: items });
}

function removeFromCollection(store, collectionKey, itemId) {
  const items = (store[collectionKey] || []).filter((row) => String(row.id) !== String(itemId));
  return saveCoachingStore(store.clubId, { ...store, [collectionKey]: items });
}

export function listCoaches(clubId) {
  return loadCoachingStore(clubId).coaches;
}

export function saveCoach(clubId, coach) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "coaches", coach, "coach");
}

export function deleteCoach(clubId, coachId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "coaches", coachId);
}

export function listStudents(clubId) {
  return loadCoachingStore(clubId).students;
}

export function saveStudent(clubId, student) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "students", student, "student");
}

export function deleteStudent(clubId, studentId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "students", studentId);
}

export function listClasses(clubId) {
  return loadCoachingStore(clubId).classes;
}

export function saveClass(clubId, classItem) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "classes", classItem, "class");
}

export function deleteClass(clubId, classId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "classes", classId);
}

export function listSchedule(clubId) {
  return loadCoachingStore(clubId).schedule;
}

export function saveScheduleEntry(clubId, entry) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "schedule", entry, "schedule");
}

export function deleteScheduleEntry(clubId, entryId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "schedule", entryId);
}

export function listPackages(clubId) {
  return loadCoachingStore(clubId).packages;
}

export function savePackage(clubId, pkg) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "packages", pkg, "package");
}

export function deletePackage(clubId, packageId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "packages", packageId);
}

export function listAttendance(clubId) {
  return loadCoachingStore(clubId).attendance;
}

export function saveAttendance(clubId, record) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "attendance", record, "attendance");
}

export function deleteAttendance(clubId, recordId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "attendance", recordId);
}

export function listEvaluations(clubId) {
  return loadCoachingStore(clubId).evaluations;
}

export function saveEvaluation(clubId, evaluation) {
  const store = loadCoachingStore(clubId);
  return upsertCollection(store, "evaluations", evaluation, "evaluation");
}

export function deleteEvaluation(clubId, evaluationId) {
  const store = loadCoachingStore(clubId);
  return removeFromCollection(store, "evaluations", evaluationId);
}

export function getCoachingSummary(clubId) {
  const store = loadCoachingStore(clubId);
  return {
    coachCount: store.coaches.length,
    studentCount: store.students.length,
    classCount: store.classes.length,
    scheduleCount: store.schedule.length,
    packageCount: store.packages.length,
    attendanceCount: store.attendance.length,
    evaluationCount: store.evaluations.length,
  };
}
