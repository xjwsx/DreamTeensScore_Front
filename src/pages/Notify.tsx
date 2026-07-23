import { useState } from "react";
import styled from "styled-components";
import { BellRing, Send } from "lucide-react";
import { sendAnnouncement } from "@/lib/api";
import { Toast, useToast } from "@/components/Toast";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Label = styled.div` font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin: 4px 0 8px; `;
const Presets = styled.div` display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 18px; `;
const Chip = styled.button`
  padding: 11px 16px; border-radius: 999px; font-size: 14px; font-weight: 700; white-space: nowrap;
  color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
  transition: transform .12s ease; &:active { transform: scale(.95); }
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

// 자주 쓰는 안내 문구. 탭하면 입력칸을 채운다.
const PRESETS = ["프로그램 종료 20분 전", "프로그램 종료 10분 전", "프로그램 종료 5분 전", "곧 시작합니다!"];

export default function Notify() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast, notify } = useToast();

  const trimmed = message.trim();

  const send = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendAnnouncement(trimmed);
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
      <Label>자주 쓰는 문구</Label>
      <Presets>
        {PRESETS.map((p) => (
          <Chip key={p} onClick={() => setMessage(p)}>{p}</Chip>
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
        접속 중인 모든 화면에 모달이 뜨고, 각자 확인 버튼을 눌러야 사라집니다.
      </Label>
    </>
  );
}
