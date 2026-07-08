import styled from "styled-components";

/**
 * 확인 모달 — 어두운 백드롭 + 가운데 아쿠아 카드 + 취소/확인 버튼.
 * 백드롭 클릭은 취소로 처리한다. open=false 면 렌더하지 않는다.
 */
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 34, 44, 0.55);
  backdrop-filter: blur(2px);
`;
const Card = styled.div`
  width: 100%;
  max-width: 340px;
  padding: 26px 22px 18px;
  text-align: center;
  color: #fff;
  border-radius: 24px;
  background: ${({ theme }) => theme.colors.screenGradient};
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4);
`;
const Title = styled.div`
  font-size: 18px;
  font-weight: 800;
`;
const Msg = styled.div`
  font-size: 14px;
  line-height: 1.5;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.85);
`;
const Actions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 22px;
`;
const Btn = styled.button<{ $variant: "cancel" | "primary" | "danger" }>`
  flex: 1;
  padding: 14px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  transition: opacity 0.12s ease, transform 0.12s ease;
  &:active { transform: scale(0.97); }
  ${({ $variant, theme }) =>
    $variant === "cancel"
      ? "background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.3); color: #fff;"
      : $variant === "danger"
      ? "background: #ef4444; color: #fff;"
      : `background: #fff; color: ${theme.colors.cta};`}
`;

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <Backdrop onClick={onCancel}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Title>{title}</Title>
        {message && <Msg>{message}</Msg>}
        <Actions>
          <Btn $variant="cancel" onClick={onCancel}>{cancelLabel}</Btn>
          <Btn $variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Btn>
        </Actions>
      </Card>
    </Backdrop>
  );
}
