import { useCallback, useEffect, useState } from "react";

/**
 * @param {{
 *   client: object,
 *   tenantId?: string|null,
 *   actor?: object|null,
 * }} props
 */
export function useCanonicalRefereeHome({ client, tenantId, actor }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.listMyAssignments({ tenantId, actor });
      if (result.ok === false) {
        setError(result.error || "Không tải được phân công");
        setAssignments([]);
      } else {
        setAssignments(result.assignments || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được phân công");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [client, tenantId, actor]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { assignments, loading, error, reload };
}
