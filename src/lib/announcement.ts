import type { Setting } from "@/types";

export interface Announcement {
  id: string;
  message: string;
  // 종료 시각(epoch ms). null 이면 카운트다운 없는 텍스트 알람.
  deadline: number | null;
}

// settings 목록에서 announcement 행의 jsonb 값을 { id, message, deadline } 로 좁힌다.
// 행이 없거나 id/message 형식이 안 맞으면 null. deadline 은 유한한 숫자일 때만 값,
// 그 외(부재·비숫자·NaN·Infinity)는 null 로 본다 → 기존 { id, message } 행과 호환.
export function parseAnnouncement(settings: Setting[]): Announcement | null {
  const raw = settings.find((s) => s.key === "announcement")?.value;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const { id, message, deadline } = raw as Record<string, unknown>;
    if (typeof id === "string" && typeof message === "string") {
      const dl = typeof deadline === "number" && Number.isFinite(deadline) ? deadline : null;
      return { id, message, deadline: dl };
    }
  }
  return null;
}

// 화면에 붙어 있는 동안 "새로 도착한" 알람인지 판정한다.
// 빈 id/빈 메시지(초기값)나 직전에 이미 띄운 id 는 표시하지 않는다.
export function shouldShowAnnouncement(prevId: string | null, next: Announcement | null): boolean {
  return !!next && next.id !== "" && next.message !== "" && next.id !== prevId;
}

// 남은 시간(ms)을 mm:ss 로 만든다. 0 이하는 "00:00", 남은 초는 올림해
// 마지막 1초 구간이 "00:00"이 아니라 "00:01"로 보이게 한다.
export function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
