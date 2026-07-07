import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Presentation, LogOut } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/context/AuthContext";
import { TeamRankRow } from "@/components/TeamRankRow";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";

const Header = styled.div` display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; `;
const Over = styled.div` font-size: 12px; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,.7); `;
const Title = styled.div` font-size: 28px; font-weight: 800; `;
const Pill = styled.button`
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #0e7490;
  background: #fff; border-radius: 16px; padding: 10px 14px;
`;
const List = styled.div` display: flex; flex-direction: column; gap: 12px; `;
const Empty = styled(Glass)` padding: 32px 20px; text-align: center; color: rgba(255,255,255,.8); margin-top: 8px; `;
const Logout = styled.button`
  align-self: center; display: flex; align-items: center; gap: 6px; margin: 16px 0 4px;
  font-size: 13px; color: rgba(255,255,255,.75);
`;

export default function Scoreboard() {
  const nav = useNavigate();
  const { teams, loading } = useTeams();
  const { logout } = useAuth();
  const activeTeams = teams.filter((t) => t.active);
  const maxScore = activeTeams.reduce((m, t) => Math.max(m, t.totalScore), 0);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <Header>
        <div>
          <Over>SUMMER RETREAT · TEENS</Over>
          <Title>틴즈 스코어보드</Title>
        </div>
        <Pill onClick={() => nav("/present")}><Presentation size={16} /> 발표 모드</Pill>
      </Header>

      {activeTeams.length === 0 ? (
        <Empty $variant="soft">아직 팀이 없어요. 팀·게임 탭에서 추가하세요.</Empty>
      ) : (
        <List>
          {activeTeams.map((t, i) => (
            <TeamRankRow key={t.id} team={t} rank={i + 1} maxScore={maxScore} />
          ))}
        </List>
      )}

      <Logout onClick={() => { void logout(); nav("/login", { replace: true }); }}>
        <LogOut size={15} /> 로그아웃
      </Logout>
    </>
  );
}
