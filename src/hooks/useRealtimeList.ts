import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { supabase } from "@/lib/supabase";

export interface RealtimeList<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// 테이블 하나를 실시간 구독하며 loading/error/refetch 를 공통 제공하는 훅.
export function useRealtimeList<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  deps: DependencyList = []
): RealtimeList<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    try {
      setData(await fetcherRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void load();
    const channel = supabase
      .channel(`${table}-changes`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (alive) void load();
      })
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, load, ...deps]);

  return { data, loading, error, refetch: load };
}
