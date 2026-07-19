import { useCallback, useEffect, useId, useRef, useState, type DependencyList } from "react";
import { supabase } from "@/lib/supabase";

export interface RealtimeList<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// 변경 이벤트를 모아 한 번만 리페치하는 창(ms). 연속 입력 때 리페치 폭주를 막는다.
const COALESCE_MS = 350;
// 접속자 전원이 같은 순간에 리페치해 스파이크를 만들지 않도록 클라이언트마다 흩뿌리는 지연(ms).
const MAX_JITTER_MS = 400;

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
  // 같은 페이지에서 같은 테이블 훅을 두 번 써도 채널 토픽이 겹치지 않도록 인스턴스별 id 를 붙인다.
  const instanceId = useId();

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
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let missed = false;

    const run = async () => {
      if (!alive) return;
      if (inFlight) {
        // 이미 요청이 떠 있으면 끝난 뒤 한 번만 더 돈다(중복 동시 요청 방지).
        missed = true;
        return;
      }
      inFlight = true;
      try {
        await load();
      } finally {
        inFlight = false;
        if (alive && missed) {
          missed = false;
          void run();
        }
      }
    };

    // 창이 이미 열려 있으면 흡수한다 — 창당 최대 1회 리페치를 보장.
    const schedule = () => {
      if (!alive || timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, COALESCE_MS + Math.random() * MAX_JITTER_MS);
    };

    void run();
    const channel = supabase
      .channel(`${table}-changes-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, schedule)
      .subscribe();
    return () => {
      alive = false;
      if (timer !== null) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, load, instanceId, ...deps]);

  return { data, loading, error, refetch: load };
}
