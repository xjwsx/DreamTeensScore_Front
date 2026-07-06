import styled from "styled-components";
import { Clock, Undo2 } from "lucide-react";
import { useScoreEntries } from "@/hooks/useScoreEntries";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { voidEntry } from "@/lib/api";
import { Glass } from "@/components/ui";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Card = styled(Glass)<{ $void?: boolean }>`
  display: flex; align-items: center; gap: 12px; padding: 13px 16px; margin-bottom: 8px;
  opacity: ${({ $void }) => ($void ? 0.45 : 1)};
`;
const Delta = styled.div<{ $neg?: boolean }>`
  font-family: ${({ theme }) => theme.font.display}; font-weight: 800; font-size: 17px;
  color: ${({ $neg }) => ($neg ? "#fecaca" : "#bbf7d0")};
`;
const UndoBtn = styled.button`
  margin-left: auto; display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700;
  color: #fff; padding: 7px 11px; border-radius: 12px; background: rgba(255,255,255,.16);
`;
const Empty = styled(Glass)` padding: 40px 20px; text-align: center; `;

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Records() {
  const { entries, loading } = useScoreEntries(80);
  const { teams } = useTeams();
  const { games } = useGames();
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "팀";
  const gameName = (id: string | null) => (id ? games.find((g) => g.id === id)?.name ?? "게임" : "직접");

  return (
    <>
      <Title>점수 기록</Title>
      {entries.length === 0 ? (
        <Empty $variant="soft">
          <Clock size={30} color="rgba(255,255,255,.8)" />
          <div style={{ fontWeight: 700, marginTop: 10 }}>{loading ? "불러오는 중…" : "아직 점수 기록이 없어요"}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 4 }}>점수를 입력하면 여기에 남습니다.</div>
        </Empty>
      ) : (
        entries.map((e) => (
          <Card key={e.id} $variant="soft" $void={e.voided}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{teamName(e.teamId)}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>{gameName(e.gameId)} · {hhmm(e.createdAt)}</div>
            </div>
            <Delta $neg={e.points < 0}>{e.points >= 0 ? `+${e.points}` : e.points}</Delta>
            {e.voided ? (
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>취소됨</span>
            ) : (
              <UndoBtn onClick={() => void voidEntry(e.id)}><Undo2 size={14} /> 취소</UndoBtn>
            )}
          </Card>
        ))
      )}
    </>
  );
}
