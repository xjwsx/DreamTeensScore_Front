import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Presentation, LogOut } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { TeamRankRow } from "@/components/TeamRankRow";
import { rankTeams } from "@/lib/ranking";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ConfirmModal } from "@/components/ConfirmModal";

const Header = styled.div` display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; `;
const Over = styled.div` font-size: 12px; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,.7); `;
const Title = styled.div` font-size: 28px; font-weight: 800; `;
const Pill = styled.button`
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #0e7490;
  background: #fff; border-radius: 16px; padding: 10px 14px;
`;
const Secret = styled(Glass)` padding: 46px 20px; text-align: center; margin-top: 8px; `;
const SecretEmoji = styled.div` font-size: 46px; margin-bottom: 12px; `;
const SecretTitle = styled.div` font-size: 20px; font-weight: 800; `;
const SecretSub = styled.div` font-size: 14px; color: rgba(255,255,255,.75); margin-top: 6px; `;
const List = styled.div` display: flex; flex-direction: column; gap: 12px; `;
const Empty = styled(Glass)` padding: 32px 20px; text-align: center; color: rgba(255,255,255,.8); margin-top: 8px; `;
const Logout = styled.button`
  align-self: center; display: flex; align-items: center; gap: 6px; margin: 16px 0 4px;
  font-size: 13px; color: rgba(255,255,255,.75);
`;

export default function Scoreboard() {
  const nav = useNavigate();
  const { teams, loading } = useTeams();
  const { hideScores, loading: sLoading } = useSettings();
  const { role, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const activeTeams = teams.filter((t) => t.active);
  const maxScore = activeTeams.reduce((m, t) => Math.max(m, t.totalScore), 0);

  // 설정 로딩까지 기다려서, 가림 상태인데 순위가 잠깐 보이는 깜빡임을 막는다
  if (loading || sLoading) return <LoadingScreen />;

  const hidden = hideScores && role === "viewer";

  return (
    <>
      <Header>
        <div>
          <Over>SUMMER RETREAT · TEENS</Over>
          <Title>틴즈 스코어보드</Title>
        </div>
        <Pill onClick={() => nav("/present")}><Presentation size={16} /> 발표 모드</Pill>
      </Header>

      {hidden ? (
        <Secret $variant="soft">
          <SecretEmoji>🤫</SecretEmoji>
          <SecretTitle>순위는 비밀이에요!</SecretTitle>
          <SecretSub>발표 시간에 공개됩니다</SecretSub>
        </Secret>
      ) : activeTeams.length === 0 ? (
        <Empty $variant="soft">아직 팀이 없어요. 팀·게임 탭에서 추가하세요.</Empty>
      ) : (
        <List>
          {rankTeams(activeTeams).map(({ team, rank, tied }) => (
            <TeamRankRow key={team.id} team={team} rank={rank} tied={tied} maxScore={maxScore} />
          ))}
        </List>
      )}

      <Logout onClick={() => setConfirmLogout(true)}>
        <LogOut size={15} /> 로그아웃
      </Logout>

      <ConfirmModal
        open={confirmLogout}
        title="로그아웃 하시겠습니까?"
        confirmLabel="로그아웃"
        cancelLabel="취소"
        onConfirm={() => { void logout(); nav("/login", { replace: true }); }}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}
