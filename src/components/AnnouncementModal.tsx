import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { BellRing } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { shouldShowAnnouncement } from "@/lib/announcement";

// 자동 소멸까지의 시간(ms). 짧게 떴다 사라지는 일시적 알람.
const AUTO_DISMISS_MS = 3500;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
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

/**
 * 브로드캐스트 알람 수신 모달. useSettings 의 announcement 를 구독하고,
 * 화면에 붙어 있는 동안 새로 도착한 id 만 띄운 뒤 AUTO_DISMISS_MS 후 자동으로 닫는다.
 * 마운트 시점의 값은 "이미 본 것"으로 저장해 새로고침·뒤늦은 접속에는 뜨지 않는다.
 * 백드롭/카드 탭하면 즉시 닫힌다. AppLayout·Present 에 각각 마운트(동시 렌더 없음).
 */
export function AnnouncementModal() {
  const { announcement, loading } = useSettings();
  const id = announcement?.id ?? "";
  const message = announcement?.message ?? "";

  const lastId = useRef<string | null>(null);
  const initialized = useRef(false);
  const timer = useRef<number>();
  const [shownMsg, setShownMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    // 첫 정착 로드: 현재 값을 "이미 본 것"으로 저장만 하고 띄우지 않는다.
    if (!initialized.current) {
      initialized.current = true;
      lastId.current = id;
      return;
    }
    const next = id === "" ? null : { id, message };
    if (shouldShowAnnouncement(lastId.current, next)) {
      lastId.current = id;
      setShownMsg(message);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShownMsg(null), AUTO_DISMISS_MS);
    }
  }, [id, message, loading]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (shownMsg === null) return null;
  return (
    <Backdrop onClick={() => setShownMsg(null)}>
      <Card onClick={() => setShownMsg(null)}>
        <IconWrap><BellRing size={34} color="#fbbf24" /></IconWrap>
        <Msg>{shownMsg}</Msg>
      </Card>
    </Backdrop>
  );
}
