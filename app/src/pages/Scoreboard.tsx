import { Screen, LargeTitle, Subtitle, Card } from "./Placeholder";
import { useTeams } from "@/hooks/useTeams";

export default function Scoreboard() {
  const { teams, loading } = useTeams();
  return (
    <Screen>
      <LargeTitle>실시간 순위</LargeTitle>
      <Subtitle>프로젝터용 순위판 (구현 예정)</Subtitle>
      <Card>
        {loading ? "불러오는 중…" : `등록된 팀 ${teams.length}개`}
      </Card>
    </Screen>
  );
}
