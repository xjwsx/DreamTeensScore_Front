import styled from "styled-components";

/** 화면 컨테이너 — 브랜드 그래디언트를 뷰포트 전체로 풀블리드(넓은 화면의 어두운 여백 제거) */
export const Screen = styled.div`
  position: relative;
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.screenGradient};
  color: ${({ theme }) => theme.colors.text};
`;

/** 배경 광원 블롭 (장식) */
export const Blob = styled.div<{ $size: number; $top: string; $left: string; $bg: string }>`
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  top: ${({ $top }) => $top};
  left: ${({ $left }) => $left};
  background: ${({ $bg }) => $bg};
  filter: blur(2px);
`;

/** 콘텐츠 레이어 (블롭 위) — 반응형 폭으로 가운데 정렬.
 *  $maxWidth 로 넓은 화면(≥768px)의 폭을 화면별로 넓힐 수 있다(기본 560px). */
export const Content = styled.div<{ $pad?: string; $maxWidth?: string }>`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: ${({ $pad }) => $pad ?? "22px 24px 32px"};
  display: flex;
  flex-direction: column;
  min-height: 100dvh;

  @media (min-width: 768px) {
    max-width: ${({ $maxWidth }) => $maxWidth ?? "560px"};
  }
`;

/** 글래스 카드 */
export const Glass = styled.div<{ $variant?: "strong" | "medium" | "soft" }>`
  background: ${({ theme, $variant = "medium" }) => theme.glass[$variant]};
  border: ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.glass.insetHi};
`;

/** 흰색 CTA 버튼 */
export const WhiteButton = styled.button<{ $color?: string }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  background: #fff;
  color: ${({ theme, $color }) => $color ?? theme.colors.cta};
  border-radius: 22px;
  padding: 19px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.985); opacity: 0.95; }
`;

/** 반투명 보조 버튼 */
export const GhostButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #fff;
  border-radius: 20px;
  padding: 16px;
  font-size: 15px;
  font-weight: 600;
  &:active { opacity: 0.9; }
`;

/** 팀 아바타 (그래디언트 원형) */
export const Avatar = styled.div<{ $bg: string; $size?: number; $ring?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  width: ${({ $size }) => $size ?? 56}px;
  height: ${({ $size }) => $size ?? 56}px;
  background: ${({ $bg }) => $bg};
  border: ${({ $ring }) => $ring ?? "2px solid rgba(255,255,255,.5)"};
  color: #fff;
  font-weight: 700;
  font-family: ${({ theme }) => theme.font.display};
  font-size: 14px;
`;

export const Display = styled.span`
  font-family: ${({ theme }) => theme.font.display};
`;
