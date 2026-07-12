import { useState } from "react";
import styled from "styled-components";
import { Check } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import { setTeamGame } from "@/lib/api";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Toast, useToast } from "@/components/Toast";
import type { Team } from "@/types";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 4px; `;
const Sub = styled.div` font-size: 13px; color: rgba(255,255,255,.7); margin-bottom: 18px; `;
const Grid = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 12px;
  @media (min-width: 768px) { grid-template-columns: repeat(2, 1fr); }
`;
const Card = styled(Glass)<{ $wait?: boolean }>`
  padding: 15px 16px;
  ${({ $wait }) => $wait && "grid-column: 1 / -1;"}
`;
const Head = styled.div` display: flex; align-items: center; gap: 9px; margin-bottom: 12px; `;
const HeadEmoji = styled.span` font-size: 22px; `;
const HeadName = styled.div` font-size: 16px; font-weight: 800; `;
const Count = styled.div`
  margin-left: auto; font-size: 12px; font-weight: 800; color: #0e7490;
  background: #fff; border-radius: 12px; padding: 4px 9px;
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
const Item = styled.button<{ $on?: boolean }>`
  width: 100%; display: flex; align-items: center; gap: 10px; text-align: left;
  padding: 14px 15px; border-radius: 16px; margin-bottom: 8px;
  font-size: 15px; font-weight: 700; color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.12)")};
  border: 1px solid rgba(255,255,255,.24);
  & .ck { margin-left: auto; }
`;

export default function Map() {
  const { teams, loading: tLoading } = useTeams();
  const { games, loading: gLoading } = useGames();
  const { role } = useAuth();
  const { toast, notify } = useToast();
  const [sheetTeam, setSheetTeam] = useState<Team | null>(null);

  if (tLoading || gLoading) return <LoadingScreen />;

  const canEdit = role === "admin" || role === "staff";
  const activeTeams = teams.filter((t) => t.active);
  const activeGames = games.filter((g) => g.active);
  const activeGameIds = new Set(activeGames.map((g) => g.id));
  // 대기: 위치 없음 또는 비활성 게임을 가리키는 팀
  const waiting = activeTeams.filter((t) => !t.currentGameId || !activeGameIds.has(t.currentGameId));

  async function move(team: Team, gameId: string | null) {
    setSheetTeam(null);
    try {
      await setTeamGame(team.id, gameId);
      const dest = gameId ? games.find((g) => g.id === gameId)?.name ?? "게임" : "대기";
      notify(`${team.name} → ${dest}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "위치를 바꾸지 못했습니다.", true);
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

      <Grid>
        <Card $wait>
          <Head>
            <HeadEmoji>⏳</HeadEmoji>
            <HeadName>대기</HeadName>
            <Count>{waiting.length}팀</Count>
          </Head>
          {waiting.length ? <Chips>{waiting.map(renderChip)}</Chips> : <EmptyChips>대기 중인 팀 없음</EmptyChips>}
        </Card>

        {activeGames.map((g) => {
          const here = activeTeams.filter((t) => t.currentGameId === g.id);
          return (
            <Card key={g.id}>
              <Head>
                <HeadEmoji>{g.emoji}</HeadEmoji>
                <HeadName>{g.name}</HeadName>
                <Count>{here.length}팀</Count>
              </Head>
              {here.length ? <Chips>{here.map(renderChip)}</Chips> : <EmptyChips>아직 없음</EmptyChips>}
            </Card>
          );
        })}
      </Grid>

      {sheetTeam && (
        <Overlay onClick={() => setSheetTeam(null)}>
          <Sheet onClick={(e) => e.stopPropagation()}>
            <SheetTitle>{sheetTeam.emoji} {sheetTeam.name} 을(를) 어디로?</SheetTitle>
            {activeGames.map((g) => (
              <Item key={g.id} $on={sheetTeam.currentGameId === g.id} onClick={() => move(sheetTeam, g.id)}>
                <span>{g.emoji}</span> {g.name}
                {sheetTeam.currentGameId === g.id && <Check className="ck" size={18} />}
              </Item>
            ))}
            <Item $on={!sheetTeam.currentGameId} onClick={() => move(sheetTeam, null)}>
              <span>⏳</span> 대기(배치 안 함)
              {!sheetTeam.currentGameId && <Check className="ck" size={18} />}
            </Item>
          </Sheet>
        </Overlay>
      )}
    </>
  );
}
