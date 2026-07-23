import { useState } from "react";
import styled from "styled-components";
import { BellRing, Send, Eye, EyeOff } from "lucide-react";
import { sendAnnouncement, setHideScores } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { Toast, useToast } from "@/components/Toast";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Label = styled.div` font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin: 4px 0 8px; `;
const Presets = styled.div` display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 18px; `;
// 문구 칩. 각 칩이 문구+카운트다운 기한을 함께 갖는다. 선택된 칩은 흰 배경으로 강조한다
// ($active 는 DOM 으로 새지 않는 transient prop).
const Chip = styled.button<{ $active: boolean }>`
  padding: 11px 16px; border-radius: 999px; font-size: 14px; font-weight: 700; white-space: nowrap;
  border: 1px solid rgba(255,255,255,.28); transition: transform .12s ease;
  color: ${({ $active }) => ($active ? "#0e7490" : "#fff")};
  background: ${({ $active }) => ($active ? "#fff" : "rgba(255,255,255,.14)")};
  &:active { transform: scale(.95); }
`;
const Input = styled.textarea`
  width: 100%; min-height: 84px; resize: vertical; padding: 14px 16px; border-radius: 18px;
  font-size: 16px; font-weight: 600; line-height: 1.4; color: #0e7490; background: #fff; border: none;
`;
const SendBtn = styled.button`
  width: 100%; margin-top: 16px; padding: 16px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 16px; font-weight: 800; color: #0e7490; background: #fff;
  transition: opacity .12s ease, transform .12s ease;
  &:active { transform: scale(.98); }
  &:disabled { opacity: .5; }
`;
const Divider = styled.div` height: 1px; background: rgba(255,255,255,.18); margin: 26px 0 18px; `;
// 스코어 가리기 토글. 가리는 중이면 반전 스타일로 상태를 드러낸다.
const HideToggle = styled.button<{ $on: boolean }>`
  width: 100%; padding: 15px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 15px; font-weight: 800;
  color: ${({ $on }) => ($on ? "#fff" : "#0e7490")};
  background: ${({ $on }) => ($on ? "rgba(255,255,255,.16)" : "#fff")};
  border: 1px solid ${({ $on }) => ($on ? "rgba(255,255,255,.4)" : "transparent")};
  transition: transform .12s ease; &:active { transform: scale(.98); }
`;

// 자주 쓰는 문구. 각 문구가 카운트다운 기한(분)을 함께 갖는다. min=null 은 카운트다운 없음.
// 탭하면 문구가 입력칸에 채워지고, 보내면 그 문구의 기한으로 자동 카운트다운된다.
const PRESETS: { message: string; min: number | null }[] = [
  { message: "프로그램 종료 20분 전", min: 20 },
  { message: "프로그램 종료 10분 전", min: 10 },
  { message: "프로그램 종료 5분 전", min: 5 },
  { message: "곧 시작합니다!", min: null },
];

export default function Notify() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { hideScores } = useSettings();
  const { toast, notify } = useToast();

  const trimmed = message.trim();
  // 선택된 프리셋(문구 일치)의 기한을 쓴다. 직접 입력한 커스텀 문구는 카운트다운 없음.
  const durMin = PRESETS.find((p) => p.message === message)?.min ?? null;

  const toggleHide = async () => {
    try {
      await setHideScores(!hideScores);
      notify(hideScores ? "스코어를 공개했어요" : "게스트에게 스코어를 가렸어요");
    } catch (e) {
      notify(e instanceof Error ? e.message : "설정을 바꾸지 못했습니다.", true);
    }
  };

  const send = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      // 선택한 분값이 있으면 지금부터 N분 뒤를 종료 시각으로. 모든 화면이 이 시각을 공유한다.
      const deadline = durMin === null ? null : Date.now() + durMin * 60_000;
      await sendAnnouncement(trimmed, deadline);
      notify("알람을 보냈어요");
      setMessage("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "알람을 보내지 못했습니다.", true);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Toast toast={toast} />
      <Title>알림 보내기</Title>
      <Label>자주 쓰는 문구 (선택하면 기한도 함께 설정)</Label>
      <Presets>
        {PRESETS.map((p) => (
          <Chip key={p.message} $active={message === p.message} onClick={() => setMessage(p.message)}>
            {p.message}
          </Chip>
        ))}
      </Presets>
      <Label>메시지</Label>
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="모든 화면에 띄울 문구를 입력하세요"
      />
      <SendBtn disabled={!trimmed || sending} onClick={() => void send()}>
        {sending ? <>보내는 중…</> : <><Send size={18} /> 보내기</>}
      </SendBtn>
      <Label style={{ marginTop: 14 }}>
        <BellRing size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        {durMin === null
          ? "접속 중인 모든 화면에 모달이 뜨고, 각자 확인 버튼을 눌러야 사라집니다."
          : `모든 화면에 ${durMin}분 카운트다운이 뜨고, 각자 확인 버튼을 눌러야 사라집니다.`}
      </Label>

      <Divider />
      <Label>게스트 화면</Label>
      <HideToggle $on={hideScores} onClick={() => void toggleHide()}>
        {hideScores ? <><EyeOff size={17} /> 가리는 중 — 공개하기</> : <><Eye size={17} /> 스코어 가리기</>}
      </HideToggle>
      <Label style={{ marginTop: 10 }}>
        가리면 게스트의 순위판·발표 화면에서 순위가 숨겨집니다.
      </Label>
    </>
  );
}
