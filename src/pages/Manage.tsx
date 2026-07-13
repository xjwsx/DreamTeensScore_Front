import { useEffect, useState } from "react";
import styled from "styled-components";
import { Plus, X, RotateCcw, Undo2 } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import {
  createTeam, updateTeam, deleteTeam, createGame, updateGame, deleteGame,
  resetAll, restoreLastReset, setTeamActive, setGameActive, lastResetInfo, type ResetInfo,
} from "@/lib/api";
import { TEAM_COLORS, TEAM_EMOJIS, GAME_EMOJIS } from "@/lib/constants";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Toast, useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";

const Section = styled.div` display: flex; align-items: center; justify-content: space-between; margin: 6px 0 12px; `;
const SectionTitle = styled.div` font-size: 17px; font-weight: 800; `;
const AddBtn = styled.button`
  display: flex; align-items: center; gap: 5px; padding: 9px 13px; border-radius: 14px;
  background: #fff; color: #0e7490; font-weight: 700; font-size: 13.5px;
`;
const CardGrid = styled.div`
  display: grid;
  /* minmax(0, 1fr): 기본값 1fr(=minmax(auto,1fr))은 트랙 최소폭이 아이템 min-content라,
     좁은 폰에서 카드가 안 줄어들어 오른쪽 삭제 버튼이 화면 밖으로 잘렸다.
     최소폭을 0으로 낮춰 카드가 화면 폭에 맞게 줄고 좌우 여백이 대칭이 되도록 한다. */
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 10px;
  @media (min-width: 768px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;
const Card = styled(Glass)<{ $off?: boolean }>` padding: 14px; opacity: ${({ $off }) => ($off ? 0.55 : 1)}; `;
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
const Switch = styled.button<{ $on?: boolean }>`
  width: 44px; height: 26px; border-radius: 14px; flex-shrink: 0; padding: 3px;
  display: flex; align-items: center; justify-content: ${({ $on }) => ($on ? "flex-end" : "flex-start")};
  background: ${({ $on }) => ($on ? "#22d3ee" : "rgba(255,255,255,.2)")};
  & > span { width: 20px; height: 20px; border-radius: 50%; background: #fff; display: block; }
`;
const DelBtn = styled.button`
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.14);
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
const ResetRow = styled.div` display: flex; align-items: center; gap: 10px; margin: 4px 2px 2px; font-size: 12.5px; color: rgba(255,255,255,.8); `;
const UndoBtn = styled.button`
  display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700;
  color: #fff; padding: 6px 10px; border-radius: 11px; background: rgba(255,255,255,.16);
`;
const AuditLine = styled.div` font-size: 11.5px; color: rgba(255,255,255,.55); margin: 6px 2px 0; text-align: center; `;

function nextIn(list: string[], cur: string): string {
  const i = list.indexOf(cur);
  return list[(i + 1) % list.length];
}
function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Manage() {
  const { teams, loading: teamsLoading } = useTeams();
  const { games, loading: gamesLoading } = useGames();
  const { userId, name } = useAuth();
  const { toast, notify } = useToast();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: "team" | "game"; name: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [lastReset, setLastReset] = useState<ResetInfo | null>(null);

  useEffect(() => { void lastResetInfo().then(setLastReset); }, []);

  async function addTeam() {
    const n = teams.length;
    try {
      await createTeam(`${n + 1}팀`, TEAM_EMOJIS[n % TEAM_EMOJIS.length], TEAM_COLORS[n % TEAM_COLORS.length]);
      notify(`${n + 1}팀을 추가했어요`);
    } catch {
      notify("팀 추가에 실패했어요", true);
    }
  }
  async function addGame() {
    try {
      await createGame("새 게임", GAME_EMOJIS[games.length % GAME_EMOJIS.length]);
      notify("게임을 추가했어요");
    } catch {
      notify("게임 추가에 실패했어요", true);
    }
  }

  async function doReset() {
    setConfirmResetOpen(false);
    try {
      const n = await resetAll(userId, name);
      notify(`${n}개 기록을 보관했어요 (총점 0)`);
      setCanUndo(true);
      void lastResetInfo().then(setLastReset);
    } catch {
      notify("초기화에 실패했어요", true);
    }
  }
  async function doUndo() {
    try {
      const n = await restoreLastReset(userId);
      notify(n > 0 ? `${n}개 기록을 되돌렸어요` : "되돌릴 기록이 없어요");
      setCanUndo(false);
      void lastResetInfo().then(setLastReset);
    } catch {
      notify("되돌리기에 실패했어요", true);
    }
  }

  async function performDelete() {
    if (!deleteTarget) return;
    const { id, kind } = deleteTarget;
    setDeleteTarget(null);
    try {
      if (kind === "team") await deleteTeam(id, userId);
      else await deleteGame(id, userId);
      notify(kind === "team" ? "팀을 삭제했어요" : "게임을 삭제했어요");
    } catch {
      // on delete restrict 위반 등 — 점수 기록이 연결된 경우
      notify("점수 기록이 있어 삭제할 수 없어요 — 대신 비활성화하세요", true);
    }
  }

  if (teamsLoading || gamesLoading) return <LoadingScreen />;

  return (
    <>
      <Toast toast={toast} />
      <Section>
        <SectionTitle>👥 팀</SectionTitle>
        <AddBtn onClick={() => void addTeam()}><Plus size={15} /> 팀 추가</AddBtn>
      </Section>
      <CardGrid>
      {teams.map((t) => (
        <Card key={t.id} $variant="medium" $off={!t.active}>
          <Row>
            <EmojiBtn onClick={() => void updateTeam(t.id, { emoji: nextIn(TEAM_EMOJIS, t.emoji) })}>{t.emoji}</EmojiBtn>
            <NameInput defaultValue={t.name} onBlur={(e) => { if (e.target.value !== t.name) void updateTeam(t.id, { name: e.target.value }); }} />
            <Switch $on={t.active} title={t.active ? "활성" : "비활성"} onClick={() => void setTeamActive(t.id, !t.active, userId)}><span /></Switch>
            <DelBtn onClick={() => setDeleteTarget({ id: t.id, kind: "team", name: t.name })}>
              <X size={18} color="#fff" />
            </DelBtn>
          </Row>
          <Palette>
            {TEAM_COLORS.map((c) => (
              <Swatch key={c} $c={c} $on={c === t.color} onClick={() => void updateTeam(t.id, { color: c })} />
            ))}
          </Palette>
        </Card>
      ))}
      </CardGrid>

      <Section style={{ marginTop: 22 }}>
        <SectionTitle>🎮 게임</SectionTitle>
        <AddBtn onClick={() => void addGame()}><Plus size={15} /> 게임 추가</AddBtn>
      </Section>
      <CardGrid>
      {games.map((g) => (
        <Card key={g.id} $variant="medium" $off={!g.active}>
          <Row>
            <EmojiBtn onClick={() => void updateGame(g.id, { emoji: nextIn(GAME_EMOJIS, g.emoji) })}>{g.emoji}</EmojiBtn>
            <NameInput defaultValue={g.name} onBlur={(e) => { if (e.target.value !== g.name) void updateGame(g.id, { name: e.target.value }); }} />
            <Switch $on={g.active} title={g.active ? "활성" : "비활성"} onClick={() => void setGameActive(g.id, !g.active, userId)}><span /></Switch>
            <DelBtn onClick={() => setDeleteTarget({ id: g.id, kind: "game", name: g.name })}>
              <X size={18} color="#fff" />
            </DelBtn>
          </Row>
        </Card>
      ))}
      </CardGrid>

      <Reset onClick={() => setConfirmResetOpen(true)}>
        <RotateCcw size={16} /> 전체 점수 · 기록 초기화
      </Reset>
      {canUndo && (
        <ResetRow>
          <span>초기화됨 — 되돌릴 수 있어요</span>
          <UndoBtn onClick={() => void doUndo()}><Undo2 size={13} /> 되돌리기</UndoBtn>
        </ResetRow>
      )}
      {lastReset && <AuditLine>마지막 초기화: {fmt(lastReset.at)} · {lastReset.by ?? "?"}</AuditLine>}

      <ConfirmModal
        open={deleteTarget !== null}
        title={`'${deleteTarget?.name ?? ""}'을(를) 삭제할까요?`}
        message="삭제하면 되돌릴 수 없어요. 점수 기록이 있으면 대신 비활성화하세요."
        confirmLabel="삭제"
        danger
        onConfirm={() => void performDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={confirmResetOpen}
        title="전체 점수·기록을 초기화할까요?"
        message="기록은 보관되어 되돌릴 수 있어요."
        confirmLabel="초기화"
        danger
        onConfirm={() => void doReset()}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </>
  );
}
