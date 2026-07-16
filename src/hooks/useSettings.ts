import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchSettings } from "@/lib/queries";

// 전역 설정 실시간 훅. hide_scores 행이 없거나(마이그레이션 전) 로딩 전이면 false(공개).
export function useSettings() {
  const { data, loading } = useRealtimeList("settings", fetchSettings);
  const hideScores = data.find((s) => s.key === "hide_scores")?.value === true;
  return { hideScores, loading };
}
