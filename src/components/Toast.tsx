import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Check, TriangleAlert } from "lucide-react";

/**
 * 화면 상단 고정 토스트 — 성공(초록)/실패(빨강)을 잠깐 알리고 자동으로 사라진다.
 * position:fixed 라 긴 페이지에서 스크롤 위치와 무관하게 항상 보인다.
 * useToast() 로 상태를 관리하고 <Toast toast={...}/> 로 렌더한다.
 */
export interface ToastState {
  err: boolean;
  msg: string;
}

const Wrap = styled.div<{ $err?: boolean }>`
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 120;
  width: calc(100% - 40px);
  max-width: 440px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: ${({ $err }) => ($err ? "rgba(239,68,68,.95)" : "rgba(16,185,129,.95)")};
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
`;

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>();

  const notify = useCallback((msg: string, err = false) => {
    setToast({ err, msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), toast.err ? 4000 : 3000);
    return () => window.clearTimeout(timer.current);
  }, [toast]);

  return { toast, notify };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <Wrap $err={toast.err}>
      {toast.err ? <TriangleAlert size={17} /> : <Check size={17} />}
      <span>{toast.msg}</span>
    </Wrap>
  );
}
