import { useState } from "react";
import styled from "styled-components";
import { Check } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import { setTeamGame, clearGame } from "@/lib/api";
import { MAX_TEAMS_PER_GAME } from "@/lib/constants";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Toast, useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { Team, Game } from "@/types";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 4px; `;
const Sub = styled.div` font-size: 13px; color: rgba(255,255,255,.7); margin-bottom: 18px; `;
const Grid = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 12px;
  @media (min-width: 768px) { grid-template-columns: repeat(2, 1fr); }
`;
const Card = styled(Glass)`
  padding: 15px 16px;
`;
const WaitCard = styled(Card)` margin-bottom: 4px; `;
const FloorTitle = styled.div` font-size: 15px; font-weight: 800; margin: 16px 2px 10px; `;
const Head = styled.div` display: flex; align-items: center; gap: 9px; margin-bottom: 12px; `;
const HeadEmoji = styled.span` font-size: 22px; `;
const HeadName = styled.div` font-size: 16px; font-weight: 800; `;
const Count = styled.div<{ $full?: boolean }>`
  margin-left: auto; font-size: 12px; font-weight: 800; border-radius: 12px; padding: 4px 9px;
  /* 꽉 찬 게임은 흐린 배지 — 빈 게임의 흰 배지가 눈에 띄어 "어디가 비었나"를 맵에서 바로 찾게 */
  color: ${({ $full }) => ($full ? "rgba(255,255,255,.75)" : "#0e7490")};
  background: ${({ $full }) => ($full ? "rgba(255,255,255,.18)" : "#fff")};
`;
const EndBtn = styled.button`
  font-size: 12px; font-weight: 700; color: #fff; padding: 6px 10px; flex-shrink: 0;
  border-radius: 11px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.3);
`;
const Chips = styled.div` display: flex; flex-wrap: wrap; gap: 8px; `;
const Chip = styled.button<{ $bg: string; $static?: boolean }>`
  display: flex; align-items: center; gap: 7px; padding: 9px 13px; border-radius: 999px;
  font-size: 14px; font-weight: 700; color: #fff;
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
  cursor: ${({ $static }) => ($static ? "default" : "pointer")};
  transition: transform .12s ease;
  &:active { transform: ${({ $static }) => ($static ? "none" : "scale(.95)")}; }
  & span.dot { width: 10px; height: 10px; border-radius: 50%; background: ${({ $bg }) => $bg}; }
`;
const EmptyChips = styled.div` font-size: 13px; color: rgba(255,255,255,.55); `;

/* 하단 게임 선택 시트 */
const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 130; background: rgba(0,0,0,.45);
  display: flex; align-items: flex-end; justify-content: center;
`;
const Sheet = styled.div`
  width: 100%; max-width: 480px; max-height: 72dvh; overflow-y: auto;
  background: ${({ theme }) => theme.colors.screenGradient};
  border-radius: 24px 24px 0 0; padding: 18px 18px 28px;
  border-top: 1px solid rgba(255,255,255,.3);
`;
const SheetTitle = styled.div` font-size: 15px; font-weight: 800; margin-bottom: 14px; `;
const SheetGroup = styled.div` font-size: 12px; font-weight: 800; color: rgba(255,255,255,.6); margin: 12px 3px 8px; `;
const FLOORS = [
  { floor: 1, label: "🏠 1층" },
  { floor: 2, label: "🏢 2층" },
];

const Item = styled.button<{ $on?: boolean; $full?: boolean }>`
  width: 100%; display: flex; align-items: center; gap: 10px; text-align: left;
  padding: 14px 15px; border-radius: 16px; margin-bottom: 8px;
  font-size: 15px; font-weight: 700; color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.12)")};
  border: 1px solid rgba(255,255,255,.24);
  opacity: ${({ $full }) => ($full ? 0.45 : 1)};
  cursor: ${({ $full }) => ($full ? "default" : "pointer")};
  & .ck { margin-left: auto; }
  & .full { margin-left: auto; font-size: 11.5px; font-weight: 800; color: rgba(255,255,255,.85); }
`;

export default function Map() {
  const { teams, loading: tLoading } = useTeams();
  const { games, loading: gLoading } = useGames();
  const { role } = useAuth();
  const { toast, notify } = useToast();
  const [sheetTeam, setSheetTeam] = useState<Team | null>(null);
  const [endTarget, setEndTarget] = useState<Game | null>(null);

  if (tLoading || gLoading) return <LoadingScreen />;

  const canEdit = role === "admin" || role === "staff";
  const activeTeams = teams.filter((t) => t.active);
  const activeGames = games.filter((g) => g.active);
  const activeGameIds = new Set(activeGames.map((g) => g.id));
  // 대기: 위치 없음 또는 비활성 게임을 가리키는 팀
  const waiting = activeTeams.filter((t) => !t.currentGameId || !activeGameIds.has(t.currentGameId));

  const countOf = (gameId: string) => activeTeams.filter((t) => t.currentGameId === gameId).length;
  const isFull = (gameId: string) => countOf(gameId) >= MAX_TEAMS_PER_GAME;

  async function move(team: Team, gameId: string | null) {
    // 클라이언트 가드 — 서버 set_team_game 도 같은 검사를 하므로 경합에도 3팀 불가
    if (gameId && gameId !== team.currentGameId && isFull(gameId)) {
      notify(`이미 ${MAX_TEAMS_PER_GAME}팀이 참여 중이에요.`, true);
      return;
    }
    setSheetTeam(null);
    try {
      await setTeamGame(team.id, gameId);
      const dest = gameId ? games.find((g) => g.id === gameId)?.name ?? "게임" : "대기";
      notify(`${team.name} → ${dest}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "위치를 바꾸지 못했습니다.", true);
    }
  }

  async function endGame() {
    if (!endTarget) return;
    const g = endTarget;
    setEndTarget(null);
    try {
      await clearGame(g.id);
      notify(`${g.name} 종료 — 팀들이 대기로 이동했어요`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "게임을 비우지 못했습니다.", true);
    }
  }

  const renderChip = (t: Team) => (
    <Chip
      key={t.id}
      $bg={t.color}
      $static={!canEdit}
      as={canEdit ? "button" : "div"}
      onClick={canEdit ? () => setSheetTeam(t) : undefined}
    >
      <span className="dot" />
      {t.emoji} {t.name}
    </Chip>
  );

  return (
    <>
      <Toast toast={toast} />
      <Title>맵</Title>
      <Sub>{canEdit ? "팀을 눌러 게임으로 이동하세요" : "각 게임에 있는 팀"}</Sub>

      <WaitCard>
        <Head>
          <HeadEmoji>⏳</HeadEmoji>
          <HeadName>대기</HeadName>
          <Count>{waiting.length}팀</Count>
        </Head>
        {waiting.length ? <Chips>{waiting.map(renderChip)}</Chips> : <EmptyChips>대기 중인 팀 없음</EmptyChips>}
      </WaitCard>

      {FLOORS.map(({ floor, label }) => {
        const floorGames = activeGames.filter((g) => g.floor === floor);
        if (!floorGames.length) return null;
        return (
          <section key={floor}>
            <FloorTitle>{label}</FloorTitle>
            <Grid>
              {floorGames.map((g) => {
                const here = activeTeams.filter((t) => t.currentGameId === g.id);
                return (
                  <Card key={g.id}>
                    <Head>
                      <HeadEmoji>{g.emoji}</HeadEmoji>
                      <HeadName>{g.name}</HeadName>
                      <Count $full={here.length >= MAX_TEAMS_PER_GAME}>{here.length}/{MAX_TEAMS_PER_GAME}팀</Count>
                      {canEdit && here.length > 0 && <EndBtn onClick={() => setEndTarget(g)}>종료</EndBtn>}
                    </Head>
                    {here.length ? <Chips>{here.map(renderChip)}</Chips> : <EmptyChips>아직 없음</EmptyChips>}
                  </Card>
                );
              })}
            </Grid>
          </section>
        );
      })}

      {sheetTeam && (
        <Overlay onClick={() => setSheetTeam(null)}>
          <Sheet onClick={(e) => e.stopPropagation()}>
            <SheetTitle>{sheetTeam.emoji} {sheetTeam.name} 을(를) 어디로?</SheetTitle>
            {FLOORS.map(({ floor, label }) => {
              const floorGames = activeGames.filter((g) => g.floor === floor);
              if (!floorGames.length) return null;
              return (
                <div key={floor}>
                  <SheetGroup>{label}</SheetGroup>
                  {floorGames.map((g) => {
                    const on = sheetTeam.currentGameId === g.id;
                    const full = !on && isFull(g.id);
                    return (
                      <Item key={g.id} $on={on} $full={full} disabled={full} onClick={() => move(sheetTeam, g.id)}>
                        <span>{g.emoji}</span> {g.name}
                        {on && <Check className="ck" size={18} />}
                        {full && <span className="full">가득 참</span>}
                      </Item>
                    );
                  })}
                </div>
              );
            })}
            <Item $on={!sheetTeam.currentGameId} onClick={() => move(sheetTeam, null)}>
              <span>⏳</span> 대기(배치 안 함)
              {!sheetTeam.currentGameId && <Check className="ck" size={18} />}
            </Item>
          </Sheet>
        </Overlay>
      )}

      <ConfirmModal
        open={endTarget !== null}
        title={`'${endTarget?.name ?? ""}' 게임을 종료할까요?`}
        message="이 게임에 있는 팀들이 대기로 이동해요."
        confirmLabel="종료"
        onConfirm={() => void endGame()}
        onCancel={() => setEndTarget(null)}
      />
    </>
  );
}
