export function ensureCollection(store, collection, fallback = []) {
  const current = store?.read?.(collection);
  if (Array.isArray(current)) {
    return current;
  }
  store?.write?.(collection, fallback);
  return fallback;
}

export function writeCollection(store, collection, value) {
  store?.write?.(collection, value);
  store?.markDirty?.(collection);
  return value;
}

export function addToCollection(store, collection, item) {
  const current = ensureCollection(store, collection, []);
  return writeCollection(store, collection, [...current, item]);
}

export function updateInCollection(store, collection, id, updater) {
  const current = ensureCollection(store, collection, []);
  const next = current.map((item) => (item.id === id ? updater(item) : item));
  writeCollection(store, collection, next);
  return next.find((item) => item.id === id) || null;
}

export function findInCollection(store, collection, predicate) {
  return ensureCollection(store, collection, []).find(predicate) || null;
}

export function filterCollection(store, collection, predicate) {
  return ensureCollection(store, collection, []).filter(predicate);
}

export function resolveNow(now) {
  return now instanceof Date ? now : new Date(now || Date.now());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
