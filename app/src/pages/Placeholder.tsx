import styled from "styled-components";

export const Screen = styled.div`
  min-height: 100%;
  padding: ${({ theme }) => theme.spacing(6)} ${({ theme }) => theme.spacing(5)};
  max-width: 480px;
  margin: 0 auto;
`;

export const LargeTitle = styled.h1`
  font-size: ${({ theme }) => theme.font.largeTitle};
  font-weight: 700;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

export const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.font.caption};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing(6)};
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.card};
  padding: ${({ theme }) => theme.spacing(5)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;
