import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { BellRing } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { shouldShowAnnouncement } from "@/lib/announcement";

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
 * 브로드캐스트 알람 수신 모달. useSettings 의 announcement 를 구독하고,
 * 화면에 붙어 있는 동안 새로 도착한 id 만 띄운다. 자동으로 닫히지 않으며,
 * "확인" 버튼을 눌러야 사라진다(백드롭/카드 탭으로는 닫히지 않음).
 * 미확인 상태에서 새 알람이 오면 이전 메시지를 최신 것으로 교체한다(화면엔 항상 1개).
 * 마운트 시점의 값은 "이미 본 것"으로 저장해 새로고침·뒤늦은 접속에는 뜨지 않는다.
 * AppLayout·Present 에 각각 마운트(동시 렌더 없음).
 */
export function AnnouncementModal() {
  const { announcement, loading } = useSettings();
  const id = announcement?.id ?? "";
  const message = announcement?.message ?? "";

  const lastId = useRef<string | null>(null);
  const initialized = useRef(false);
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
    // 새 알람이 오면 미확인 메시지를 최신 것으로 교체한다(누적하지 않음).
    if (shouldShowAnnouncement(lastId.current, next)) {
      lastId.current = id;
      setShownMsg(message);
    }
  }, [id, message, loading]);

  const dismiss = () => setShownMsg(null);

  if (shownMsg === null) return null;
  return (
    <Backdrop>
      <Card>
        <IconWrap><BellRing size={34} color="#fbbf24" /></IconWrap>
        <Msg>{shownMsg}</Msg>
        <ConfirmBtn onClick={dismiss}>확인</ConfirmBtn>
      </Card>
    </Backdrop>
  );
}
