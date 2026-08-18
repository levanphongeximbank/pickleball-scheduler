/**
 * Build-time stub so the Referee V5 Edge bundle does not ingest the browser
 * Supabase SDK. Runtime Edge uses Deno createClient in index.ts.
 */
export function createClient() {
  return {
    from() {
      return this;
    },
    rpc: async () => ({ data: null, error: { message: "edge-bundle-stub" } }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "edge-bundle-stub" } }),
    },
  };
}

export default { createClient };
