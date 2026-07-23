import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { BellRing } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { shouldShowAnnouncement, formatRemaining, type Announcement } from "@/lib/announcement";

// 확인한 카운트다운 id 를 세션에 남겨 새로고침해도 다시 뜨지 않게 한다.
// (아직 안 본 late-joiner 에겐 정상적으로 뜬다.) 현재 알람은 항상 1개라 최신 id 하나면 충분.
const DISMISS_KEY = "announcement-dismissed-id";
function readDismissed(): string | null {
  try { return sessionStorage.getItem(DISMISS_KEY); } catch { return null; }
}
function writeDismissed(id: string) {
  try { sessionStorage.setItem(DISMISS_KEY, id); } catch { /* 무시 */ }
}

// deadline 이 있고 아직 미래면 "활성 카운트다운" — 늦게 접속한 화면도 띄워야 한다.
function isActiveCountdown(a: Announcement | null): boolean {
  return !!a && a.deadline !== null && a.deadline > Date.now();
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  /* ConfirmModal(150)보다 아래에 두어, 확인창이 떠 있을 때 알람이 그 위를 덮지 않게 한다. */
  z-index: 140;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 34, 44, 0.55);
  backdrop-filter: blur(2px);
`;
const Card = styled.div`
  width: 100%;
  max-width: 360px;
  padding: 30px 24px;
  text-align: center;
  color: #fff;
  border-radius: 24px;
  background: ${({ theme }) => theme.colors.screenGradient};
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4);
`;
const IconWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
`;
const Msg = styled.div`
  font-size: 22px;
  font-weight: 800;
  line-height: 1.4;
  word-break: keep-all;
`;
const Countdown = styled.div`
  margin-top: 12px;
  font-size: 46px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  small {
    display: block;
    margin-top: 2px;
    font-size: 14px;
    font-weight: 700;
    opacity: 0.75;
  }
`;
const ConfirmBtn = styled.button`
  width: 100%;
  margin-top: 22px;
  padding: 14px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 800;
  color: #0e7490;
  background: #fff;
  transition: transform 0.12s ease;
  &:active {
    transform: scale(0.97);
  }
`;

/**
 * 브로드캐스트 알람 수신 모달. useSettings 의 announcement 를 구독한다.
 * - 카운트다운 알람(deadline 있음): 모든 화면이 같은 종료 시각으로 mm:ss 남은 시간을
 *   1초마다 갱신. 활성(미래)이면 늦게 접속한 화면도 마운트 시 띄운다. 0 에 닿으면
 *   00:00 에서 멈추고, 확인을 눌러야 닫힌다(확인 id 는 세션에 남겨 새로고침 재표시 방지).
 * - 텍스트 알람(deadline 없음): 접속 중 새로 도착한 것만 띄운다(마운트 값은 "이미 본 것").
 * 미확인 중 새 알람이 오면 최신 것으로 교체(누적 없음). 백드롭/카드 탭으로는 닫히지 않는다.
 * AppLayout·Present 에 각각 마운트(동시 렌더 없음).
 */
export function AnnouncementModal() {
  const { announcement, loading } = useSettings();
  const id = announcement?.id ?? "";
  const message = announcement?.message ?? "";
  const deadline = announcement?.deadline ?? null;

  const lastId = useRef<string | null>(null);
  const initialized = useRef(false);
  const [shown, setShown] = useState<Announcement | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (loading) return;
    const current: Announcement | null = id === "" ? null : { id, message, deadline };
    // 첫 정착 로드.
    if (!initialized.current) {
      initialized.current = true;
      lastId.current = id;
      // 늦게 접속: 활성 카운트다운이고 이 세션에서 확인하지 않았으면 띄운다.
      if (isActiveCountdown(current) && current!.id !== readDismissed()) setShown(current);
      return;
    }
    // 접속 중 새로 도착: 텍스트·카운트다운 모두 최신 것으로 교체해 띄운다.
    if (shouldShowAnnouncement(lastId.current, current)) {
      lastId.current = id;
      setShown(current);
    }
  }, [id, message, deadline, loading]);

  // 카운트다운이 떠 있는 동안 1초마다 남은 시간을 다시 그린다. 0 이하면 멈춘다(00:00 유지).
  useEffect(() => {
    if (!shown || shown.deadline === null || shown.deadline <= Date.now()) return;
    const t = window.setInterval(() => {
      forceTick((n) => n + 1);
      if (shown.deadline !== null && shown.deadline <= Date.now()) window.clearInterval(t);
    }, 1000);
    return () => window.clearInterval(t);
  }, [shown]);

  // 확인 시 카운트다운 알람은 id 를 세션에 남겨 새로고침 재표시를 막는다.
  const dismiss = () => {
    if (shown && shown.deadline !== null) writeDismissed(shown.id);
    setShown(null);
  };

  if (shown === null) return null;
  const remaining = shown.deadline !== null ? formatRemaining(shown.deadline - Date.now()) : null;
  return (
    <Backdrop>
      <Card>
        <IconWrap><BellRing size={34} color="#fbbf24" /></IconWrap>
        <Msg>{shown.message}</Msg>
        {remaining && <Countdown>{remaining}<small>남음</small></Countdown>}
        <ConfirmBtn onClick={dismiss}>확인</ConfirmBtn>
      </Card>
    </Backdrop>
  );
}
