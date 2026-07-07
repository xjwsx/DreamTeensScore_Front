import { Component, type ReactNode } from "react";
import styled from "styled-components";
import { TriangleAlert, RotateCcw, Home } from "lucide-react";

/**
 * 전역 에러 경계 — 하위 트리에서 렌더 중 예외가 나면 흰 화면 대신
 * 아쿠아 톤 안내 화면을 보여준다. 복구는 새로고침 / 홈 이동으로 처리해
 * 라우터 컨텍스트 없이도 동작하도록 window.location 을 사용한다.
 */
const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 32px;
  text-align: center;
  color: #fff;
  background: ${({ theme }) => theme.colors.screenGradient};
`;
const IconWrap = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.glass.medium};
  border: ${({ theme }) => theme.glass.border};
`;
const Title = styled.div`
  font-size: 22px;
  font-weight: 800;
`;
const Sub = styled.div`
  font-size: 14px;
  line-height: 1.5;
  max-width: 300px;
  color: rgba(255, 255, 255, 0.8);
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 280px;
  margin-top: 8px;
`;
const Primary = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.cta};
  background: #fff;
`;
const Ghost = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 15px;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.3);
`;

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // 개발/운영 디버깅용 — 실제 오류를 콘솔에 남긴다.
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Screen>
        <IconWrap>
          <TriangleAlert size={38} color="#fff" />
        </IconWrap>
        <Title>문제가 발생했어요</Title>
        <Sub>일시적인 오류일 수 있어요. 다시 시도하거나 순위판으로 돌아가 주세요.</Sub>
        <Actions>
          <Primary onClick={() => window.location.reload()}>
            <RotateCcw size={18} /> 다시 시도
          </Primary>
          <Ghost onClick={() => window.location.assign("/board")}>
            <Home size={18} /> 홈으로
          </Ghost>
        </Actions>
      </Screen>
    );
  }
}
