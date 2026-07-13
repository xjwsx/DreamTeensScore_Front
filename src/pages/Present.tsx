import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Trophy, X } from "lucide-react";
import { Screen, Blob, Content } from "@/components/ui";
import { useTeams } from "@/hooks/useTeams";
import { TeamRankRow } from "@/components/TeamRankRow";
import { rankTeams } from "@/lib/ranking";
import { LoadingScreen } from "@/components/LoadingScreen";

const Header = styled.div` display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; `;
const Title = styled.div` display: flex; align-items: center; gap: 10px; font-size: 30px; font-weight: 800; `;
const Exit = styled.button`
  display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: #0e7490;
  background: #fff; border-radius: 16px; padding: 10px 15px;
`;
const List = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
  }
`;

export default function Present() {
  const nav = useNavigate();
  const { teams, loading } = useTeams();
  const activeTeams = teams.filter((t) => t.active);
  const maxScore = activeTeams.reduce((m, t) => Math.max(m, t.totalScore), 0);

  if (loading) return <LoadingScreen />;

  return (
    <Screen>
      <Blob $size={340} $top="-70px" $left="120px" $bg="radial-gradient(circle,rgba(255,255,255,.4),transparent 62%)" />
      <Blob $size={260} $top="320px" $left="-80px" $bg="radial-gradient(circle,rgba(45,212,191,.5),transparent 65%)" />
      <Content $maxWidth="1040px">
        <Header>
          <Title><Trophy size={30} color="#fbbf24" /> 실시간 순위</Title>
          <Exit onClick={() => nav("/board")}><X size={16} /> 나가기</Exit>
        </Header>
        <List>
          {rankTeams(activeTeams).map(({ team, rank, tied }) => (
            <TeamRankRow key={team.id} team={team} rank={rank} tied={tied} maxScore={maxScore} big />
          ))}
        </List>
      </Content>
    </Screen>
  );
}
