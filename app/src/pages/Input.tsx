import { useState } from "react";
import styled from "styled-components";
import { Minus, Plus } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import { addScore } from "@/lib/api";
import { SCORE_UNITS } from "@/lib/constants";
import { Glass } from "@/components/ui";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Label = styled.div` font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin-bottom: 8px; `;
const ChipRow = styled.div` display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; `;
const Chip = styled.button<{ $on?: boolean }>`
  flex-shrink: 0; padding: 10px 15px; border-radius: 16px; font-size: 14px; font-weight: 700;
  color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.16)")};
  border: 1px solid rgba(255,255,255,.3);
`;
const CustomInput = styled.input`
  width: 74px; padding: 10px 12px; border-radius: 16px; font-size: 14px; font-weight: 700; text-align: center;
  color: #0e7490; background: #fff; border: none;
`;
const TeamCard = styled(Glass)` display: flex; align-items: center; gap: 14px; padding: 16px; margin-bottom: 12px; `;
const Emoji = styled.div`
  width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  font-size: 26px; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3);
`;
const Step = styled.button<{ $bg?: string }>`
  width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: ${({ $bg }) => $bg ?? "rgba(255,255,255,.18)"};
  border: 1px solid rgba(255,255,255,.3);
`;
const Empty = styled(Glass)` padding: 28px 20px; text-align: center; color: rgba(255,255,255,.8); `;

export default function Input() {
  const { teams } = useTeams();
  const { games } = useGames();
  const { session } = useAuth();
  const [gameId, setGameId] = useState<string | null>(null);
  const [unit, setUnit] = useState<number>(5);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("3");

  const activeGameId = gameId ?? games[0]?.id ?? null;
  const effectiveUnit = custom ? Number(customVal) || 0 : unit;
  const createdBy = session && session.role !== "viewer" ? session.userId : null;

  async function give(teamId: string, sign: 1 | -1) {
    if (effectiveUnit === 0) return;
    await addScore(teamId, activeGameId, sign * effectiveUnit, createdBy);
  }

  return (
    <>
      <Title>점수 입력</Title>

      <Label>게임 선택</Label>
      {games.length === 0 ? (
        <Empty $variant="soft" style={{ marginBottom: 16 }}>게임이 없어요. 팀·게임 탭에서 추가하세요.</Empty>
      ) : (
        <ChipRow>
          {games.map((g) => (
            <Chip key={g.id} $on={g.id === activeGameId} onClick={() => setGameId(g.id)}>{g.emoji} {g.name}</Chip>
          ))}
        </ChipRow>
      )}

      <Label>점수 단위</Label>
      <ChipRow>
        {SCORE_UNITS.map((u) => (
          <Chip key={u} $on={!custom && unit === u} onClick={() => { setCustom(false); setUnit(u); }}>+{u}</Chip>
        ))}
        <Chip $on={custom} onClick={() => setCustom(true)}>직접</Chip>
        {custom && (
          <CustomInput value={customVal} inputMode="numeric"
            onChange={(e) => setCustomVal(e.target.value.replace(/[^0-9]/g, ""))} />
        )}
      </ChipRow>

      {teams.map((t) => (
        <TeamCard key={t.id} $variant="medium">
          <Emoji>{t.emoji}</Emoji>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Pretendard',sans-serif" }}>{t.totalScore}</div>
          </div>
          <Step onClick={() => void give(t.id, -1)}><Minus size={22} color="#fff" /></Step>
          <Step $bg={t.color} onClick={() => void give(t.id, 1)}><Plus size={22} color="#fff" /></Step>
        </TeamCard>
      ))}
    </>
  );
}
