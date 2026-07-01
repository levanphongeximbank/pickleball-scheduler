/** Normalize plan id/code between app layer and Supabase schema. */
export function planIdFromCode(planCode) {
  const code = String(planCode || "TRIAL").toUpperCase();
  if (code.startsWith("plan-")) {
    return code;
  }
  return `plan-${code}`;
}

export function planCodeFromId(planId) {
  const raw = String(planId || "TRIAL");
  if (raw.startsWith("plan-")) {
    return raw.slice(5).toUpperCase();
  }
  return raw.toUpperCase();
}

/** Map Supabase row → in-memory billing store shape. */
export function deserializeBillingRow(collection, row) {
  if (!row || typeof row !== "object") {
    return row;
  }

  if (collection === "subscriptions") {
    return {
      ...row,
      plan_code: row.plan_code || planCodeFromId(row.plan_id),
    };
  }

  if (collection === "planLimits") {
    return {
      ...row,
      plan_code: row.plan_code || planCodeFromId(row.plan_id),
    };
  }

  return row;
}

/** Map in-memory row → Supabase upsert payload (strip app-only fields). */
export function serializeBillingRow(collection, row) {
  if (!row || typeof row !== "object") {
    return row;
  }

  if (collection === "subscriptions") {
    const { plan_code: planCode, ...rest } = row;
    return {
      ...rest,
      plan_id: rest.plan_id?.startsWith("plan-")
        ? rest.plan_id
        : planIdFromCode(planCode || rest.plan_id),
    };
  }

  if (collection === "planLimits") {
    const { plan_code: planCode, ...rest } = row;
    return {
      ...rest,
      plan_id: rest.plan_id?.startsWith("plan-")
        ? rest.plan_id
        : planIdFromCode(planCode || rest.plan_id),
    };
  }

  if (collection === "plans") {
    const rest = { ...row };
    delete rest.plan_code;
    return rest;
  }

  return row;
}
