export function createMemoryBillingStore(seed = {}) {
  const state = {
    plans: [],
    planLimits: [],
    subscriptions: [],
    invoices: [],
    invoiceItems: [],
    payments: [],
    billingEvents: [],
    billingAuditLogs: [],
    ...seed,
  };

  return {
    mode: "memory",
    read(collection) {
      return state[collection] ? [...state[collection]] : [];
    },
    write(collection, value) {
      state[collection] = Array.isArray(value) ? [...value] : value;
      return state[collection];
    },
    reset(nextSeed = {}) {
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, {
        plans: [],
        planLimits: [],
        subscriptions: [],
        invoices: [],
        invoiceItems: [],
        payments: [],
        billingEvents: [],
        billingAuditLogs: [],
        ...nextSeed,
      });
    },
  };
}
