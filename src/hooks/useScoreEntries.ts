import { useCallback } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchScoreEntries } from "@/lib/queries";

export function useScoreEntries(limit = 100) {
  const fetcher = useCallback(() => fetchScoreEntries(limit), [limit]);
  const { data, loading, error, refetch } = useRealtimeList("score_entries", fetcher, [limit]);
  return { entries: data, loading, error, refetch };
}
