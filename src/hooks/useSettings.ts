import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchSettings } from "@/lib/queries";
import { parseAnnouncement, type Announcement } from "@/lib/announcement";

// 전역 설정 실시간 훅. hide_scores 행이 없거나(마이그레이션 전) 로딩 전이면 false(공개).
// announcement 는 브로드캐스트 알람의 최신 값(없으면 null).
export function useSettings(): {
  hideScores: boolean;
  announcement: Announcement | null;
  loading: boolean;
} {
  const { data, loading } = useRealtimeList("settings", fetchSettings);
  const hideScores = data.find((s) => s.key === "hide_scores")?.value === true;
  const announcement = parseAnnouncement(data);
  return { hideScores, announcement, loading };
}
