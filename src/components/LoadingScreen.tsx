import styled, { keyframes } from "styled-components";

/**
 * 전체 화면 로딩 오버레이 — 아쿠아 배경 + 중앙 회전 스피너 + "로딩 중" 텍스트.
 * position:fixed 라 DOM 위치와 무관하게 하단 탭바까지 전체를 덮는다.
 * 인증 대기·로그인·데이터 로딩 어디서든 재사용.
 */
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: ${({ theme }) => theme.colors.screenGradient};
`;

const Spinner = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.28);
  border-top-color: #fff;
  animation: ${spin} 0.8s linear infinite;
`;

const Label = styled.div`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.85);
`;

export function LoadingScreen({ label = "로딩 중" }: { label?: string }) {
  return (
    <Overlay>
      <Spinner />
      <Label>{label}</Label>
    </Overlay>
  );
}
