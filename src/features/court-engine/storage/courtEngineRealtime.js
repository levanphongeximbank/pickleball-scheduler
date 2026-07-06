import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  isCourtEngineCloudEnabled,
  pullCourtEngineFromCloud,
  ACTIVE_TABLE,
  STORES_TABLE,
} from "./courtEngineCloudStore.js";

/** Subscribe Supabase Realtime — fallback poll vẫn chạy trong useCourtEngine. */
export function subscribeCourtEngineCloud(clubId, tenantId, onChange) {
  const supabase = getSupabaseAuthClient();
  if (!supabase || !isCourtEngineCloudEnabled() || !clubId || !tenantId) {
    return () => {};
  }

  const tid = String(tenantId);
  const cid = String(clubId);
  let pullTimer = null;

  const schedulePull = () => {
    if (pullTimer) {
      return;
    }
    pullTimer = window.setTimeout(() => {
      pullTimer = null;
      void pullCourtEngineFromCloud(cid, tid).then((result) => {
        if (result.ok) {
          onChange(result);
        }
      });
    }, 250);
  };

  const channel = supabase
    .channel(`court-engine-rt-${tid}-${cid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: STORES_TABLE,
        filter: `tenant_id=eq.${tid}`,
      },
      (payload) => {
        const rowClub = payload.new?.club_id || payload.old?.club_id;
        if (rowClub && String(rowClub) !== cid) {
          return;
        }
        schedulePull();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: ACTIVE_TABLE,
        filter: `tenant_id=eq.${tid}`,
      },
      (payload) => {
        const rowClub = payload.new?.club_id || payload.old?.club_id;
        if (rowClub && String(rowClub) !== cid) {
          return;
        }
        schedulePull();
      }
    )
    .subscribe();

  return () => {
    if (pullTimer) {
      window.clearTimeout(pullTimer);
    }
    supabase.removeChannel(channel);
  };
}
