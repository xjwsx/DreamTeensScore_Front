import type { Setting } from "@/types";

export interface Announcement {
  id: string;
  message: string;
}

// settings 목록에서 announcement 행의 jsonb 값을 { id, message } 로 좁힌다.
// 행이 없거나 형식이 안 맞으면 null.
export function parseAnnouncement(settings: Setting[]): Announcement | null {
  const raw = settings.find((s) => s.key === "announcement")?.value;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const { id, message } = raw as Record<string, unknown>;
    if (typeof id === "string" && typeof message === "string") return { id, message };
  }
  return null;
}

// 화면에 붙어 있는 동안 "새로 도착한" 알람인지 판정한다.
// 빈 id/빈 메시지(초기값)나 직전에 이미 띄운 id 는 표시하지 않는다.
export function shouldShowAnnouncement(prevId: string | null, next: Announcement | null): boolean {
  return !!next && next.id !== "" && next.message !== "" && next.id !== prevId;
}
