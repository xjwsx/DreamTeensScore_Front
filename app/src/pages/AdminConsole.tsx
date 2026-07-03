import { Screen, LargeTitle, Subtitle, Card } from "./Placeholder";
import { useGames } from "@/hooks/useGames";

export default function AdminConsole() {
  const { games, loading } = useGames();
  return (
    <Screen>
      <LargeTitle>게임 관리</LargeTitle>
      <Subtitle>게임 · 점수 사전 설정 (구현 예정)</Subtitle>
      <Card>
        {loading ? "불러오는 중…" : `등록된 게임 ${games.length}개`}
      </Card>
    </Screen>
  );
}
