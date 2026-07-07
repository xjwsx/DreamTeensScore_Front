import styled from "styled-components";
import type { Team } from "@/types";

const Row = styled.div<{ $edge: string; $big?: boolean }>`
  position: relative;
  display: flex; align-items: center; gap: 14px;
  padding: ${({ $big }) => ($big ? "20px 20px 20px 24px" : "16px 18px 16px 22px")};
  background: ${({ theme }) => theme.glass.medium};
  border: ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  &::before {
    content: ""; position: absolute; left: 0; top: 12%; height: 76%; width: 6px;
    border-radius: 0 6px 6px 0; background: ${({ $edge }) => $edge};
  }
`;
const Badge = styled.div<{ $bg: string; $plain?: boolean }>`
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: ${({ theme }) => theme.font.display}; font-weight: 800; font-size: 15px;
  color: ${({ $plain }) => ($plain ? "rgba(255,255,255,.85)" : "#4a2e00")};
  background: ${({ $bg, $plain }) => ($plain ? "rgba(255,255,255,.14)" : $bg)};
`;
const Emoji = styled.div<{ $big?: boolean }>`
  width: ${({ $big }) => ($big ? 52 : 44)}px; height: ${({ $big }) => ($big ? 52 : 44)}px;
  border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: ${({ $big }) => ($big ? 28 : 24)}px;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3);
`;
const Name = styled.div<{ $big?: boolean }>`
  font-weight: 700; font-size: ${({ $big }) => ($big ? 19 : 16)}px; margin-bottom: 7px;
`;
const Bar = styled.div` height: 7px; border-radius: 4px; background: rgba(255,255,255,.2); overflow: hidden; `;
const Fill = styled.div<{ $w: number; $c: string }>`
  width: ${({ $w }) => $w}%; height: 100%; border-radius: 4px; background: ${({ $c }) => $c};
  transition: width .4s ease;
`;
const Score = styled.div<{ $big?: boolean }>`
  font-family: ${({ theme }) => theme.font.display}; font-weight: 800;
  font-size: ${({ $big }) => ($big ? 34 : 26)}px; flex-shrink: 0;
`;

const MEDAL: Record<number, string> = {
  1: "linear-gradient(150deg,#fde68a,#fbbf24)",
  2: "linear-gradient(150deg,#f1f5f9,#cbd5e1)",
  3: "linear-gradient(150deg,#fed7aa,#fb923c)",
};

export function TeamRankRow({ team, rank, maxScore, big }: { team: Team; rank: number; maxScore: number; big?: boolean }) {
  const pct = maxScore > 0 ? Math.min(100, Math.round((team.totalScore / maxScore) * 100)) : 0;
  const medal = MEDAL[rank];
  return (
    <Row $edge={team.color} $big={big}>
      <Badge $bg={medal ?? ""} $plain={!medal}>{rank}</Badge>
      <Emoji $big={big}>{team.emoji}</Emoji>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Name $big={big}>{team.name}</Name>
        <Bar><Fill $w={pct} $c={team.color} /></Bar>
      </div>
      <Score $big={big}>{team.totalScore}</Score>
    </Row>
  );
}
