import { createContext, useContext, type ReactNode } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchSettings } from "@/lib/queries";
import { parseAnnouncement, type Announcement } from "@/lib/announcement";

// 전역 설정을 한 번만 실시간 구독해 여러 소비자(순위판·발표·알람 모달)가 공유한다.
// 이전에는 컴포넌트마다 useSettings 가 각자 구독해 클라이언트당 리페치가 중복됐다.
interface SettingsValue {
  hideScores: boolean;
  announcement: Announcement | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, loading } = useRealtimeList("settings", fetchSettings);
  const hideScores = data.find((s) => s.key === "hide_scores")?.value === true;
  const announcement = parseAnnouncement(data);
  return (
    <SettingsContext.Provider value={{ hideScores, announcement, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
