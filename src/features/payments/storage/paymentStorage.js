const TX_KEY = "pickleball-payment-transactions-v1";
const CB_KEY = "pickleball-payment-callbacks-v1";
const RF_KEY = "pickleball-payment-refunds-v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadPaymentTransactions() {
  return readJson(TX_KEY, []);
}

export function savePaymentTransactions(items) {
  writeJson(TX_KEY, items || []);
}

export function loadPaymentCallbacks() {
  return readJson(CB_KEY, []);
}

export function savePaymentCallbacks(items) {
  writeJson(CB_KEY, items || []);
}

export function loadPaymentRefunds() {
  return readJson(RF_KEY, []);
}

export function savePaymentRefunds(items) {
  writeJson(RF_KEY, items || []);
}

export function clearPaymentStorage() {
  localStorage.removeItem(TX_KEY);
  localStorage.removeItem(CB_KEY);
  localStorage.removeItem(RF_KEY);
}
