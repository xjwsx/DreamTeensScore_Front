import { useState } from "react";
import styled from "styled-components";
import { Plus, X, RotateCcw } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import {
  createTeam, updateTeam, deleteTeam, createGame, updateGame, deleteGame, resetAll,
} from "@/lib/api";
import { TEAM_COLORS, TEAM_EMOJIS, GAME_EMOJIS } from "@/lib/constants";
import { Glass } from "@/components/ui";

const Section = styled.div` display: flex; align-items: center; justify-content: space-between; margin: 6px 0 12px; `;
const SectionTitle = styled.div` font-size: 17px; font-weight: 800; `;
const AddBtn = styled.button`
  display: flex; align-items: center; gap: 5px; padding: 9px 13px; border-radius: 14px;
  background: #fff; color: #0e7490; font-weight: 700; font-size: 13.5px;
`;
const Card = styled(Glass)` padding: 14px; margin-bottom: 10px; `;
const Row = styled.div` display: flex; align-items: center; gap: 10px; `;
const EmojiBtn = styled.button`
  width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0; font-size: 24px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35);
`;
const NameInput = styled.input`
  flex: 1; min-width: 0; border: 1px solid rgba(255,255,255,.3); border-radius: 12px;
  padding: 11px 13px; background: rgba(255,255,255,.12); color: #fff; font-size: 15px; font-weight: 600;
`;
const DelBtn = styled.button`
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.14);
`;
const Palette = styled.div` display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; `;
const Swatch = styled.button<{ $c: string; $on?: boolean }>`
  width: 28px; height: 28px; border-radius: 50%; background: ${({ $c }) => $c};
  border: ${({ $on }) => ($on ? "3px solid #fff" : "2px solid rgba(255,255,255,.4)")};
`;
const Reset = styled.button`
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
  margin: 8px 0 4px; padding: 15px; border-radius: 16px; font-size: 14px; font-weight: 700;
  color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.3);
`;

function nextIn(list: string[], cur: string): string {
  const i = list.indexOf(cur);
  return list[(i + 1) % list.length];
}

export default function Manage() {
  const { teams } = useTeams();
  const { games } = useGames();
  const [confirmReset, setConfirmReset] = useState(false);

  async function addTeam() {
    const n = teams.length;
    await createTeam(`${n + 1}팀`, TEAM_EMOJIS[n % TEAM_EMOJIS.length], TEAM_COLORS[n % TEAM_COLORS.length]);
  }
  async function addGame() {
    await createGame("새 게임", GAME_EMOJIS[games.length % GAME_EMOJIS.length]);
  }
  async function doReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    await resetAll();
    setConfirmReset(false);
  }

  return (
    <>
      <Section>
        <SectionTitle>👥 팀</SectionTitle>
        <AddBtn onClick={() => void addTeam()}><Plus size={15} /> 팀 추가</AddBtn>
      </Section>
      {teams.map((t) => (
        <Card key={t.id} $variant="medium">
          <Row>
            <EmojiBtn onClick={() => void updateTeam(t.id, { emoji: nextIn(TEAM_EMOJIS, t.emoji) })}>{t.emoji}</EmojiBtn>
            <NameInput defaultValue={t.name} onBlur={(e) => { if (e.target.value !== t.name) void updateTeam(t.id, { name: e.target.value }); }} />
            <DelBtn onClick={() => void deleteTeam(t.id)}><X size={18} color="#fff" /></DelBtn>
          </Row>
          <Palette>
            {TEAM_COLORS.map((c) => (
              <Swatch key={c} $c={c} $on={c === t.color} onClick={() => void updateTeam(t.id, { color: c })} />
            ))}
          </Palette>
        </Card>
      ))}

      <Section style={{ marginTop: 22 }}>
        <SectionTitle>🎮 게임</SectionTitle>
        <AddBtn onClick={() => void addGame()}><Plus size={15} /> 게임 추가</AddBtn>
      </Section>
      {games.map((g) => (
        <Card key={g.id} $variant="medium">
          <Row>
            <EmojiBtn onClick={() => void updateGame(g.id, { emoji: nextIn(GAME_EMOJIS, g.emoji) })}>{g.emoji}</EmojiBtn>
            <NameInput defaultValue={g.name} onBlur={(e) => { if (e.target.value !== g.name) void updateGame(g.id, { name: e.target.value }); }} />
            <DelBtn onClick={() => void deleteGame(g.id)}><X size={18} color="#fff" /></DelBtn>
          </Row>
        </Card>
      ))}

      <Reset onClick={() => void doReset()}>
        <RotateCcw size={16} /> {confirmReset ? "한 번 더 탭하면 전체 초기화" : "전체 점수 · 기록 초기화"}
      </Reset>
    </>
  );
}
