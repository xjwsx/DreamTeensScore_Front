import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Minus, Plus, Check, TriangleAlert, Undo2 } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import { addScore, voidEntry } from "@/lib/api";
import { SCORE_UNITS } from "@/lib/constants";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Label = styled.div` font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin-bottom: 8px; `;
const ChipRow = styled.div`
  display: flex;
  gap: 9px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  padding: 2px 2px 8px;
  margin-bottom: 16px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
  &::-webkit-scrollbar { display: none; } /* Chrome/Safari */
  /* 우측 끝단 페이드 — "더 있음" 스크롤 힌트 */
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 22px), transparent);
`;
const Chip = styled.button<{ $on?: boolean }>`
  flex-shrink: 0;
  scroll-snap-align: start;
  padding: 11px 17px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.14)")};
  border: 1px solid ${({ $on }) => ($on ? "transparent" : "rgba(255,255,255,.28)")};
  backdrop-filter: blur(6px);
  transition: transform .12s ease, background .14s ease, color .14s ease;
  &:active { transform: scale(.95); }
`;
const CustomInput = styled.input`
  flex-shrink: 0;
  scroll-snap-align: start;
  width: 74px; padding: 11px 12px; border-radius: 999px; font-size: 14px; font-weight: 700; text-align: center;
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
  transition: opacity .12s ease;
  &:disabled { opacity: .5; }
`;
const Empty = styled(Glass)` padding: 28px 20px; text-align: center; color: rgba(255,255,255,.8); `;
const Toast = styled.div<{ $err?: boolean }>`
  display: flex; align-items: center; gap: 9px; margin-bottom: 14px;
  padding: 12px 14px; border-radius: 16px; font-size: 14px; font-weight: 700;
  color: #fff;
  background: ${({ $err }) => ($err ? "rgba(239,68,68,.9)" : "rgba(16,185,129,.9)")};
  border: 1px solid rgba(255,255,255,.35);
`;
const ToastUndo = styled.button`
  margin-left: auto; display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700;
  color: #fff; padding: 6px 10px; border-radius: 11px; background: rgba(255,255,255,.22);
`;

interface Feedback {
  err: boolean;
  msg: string;
  entryId?: string;
}

/**
 * 데스크톱 마우스 휠(세로)을 가로 스크롤로 변환 — 스크롤바 없이도 칩 줄을 넘길 수 있게.
 * 콜백 ref로 구현 — 조건부 렌더(데이터 로드 후 마운트)되는 줄에도 리스너가 확실히 붙는다.
 */
function useHorizontalWheel<T extends HTMLElement>() {
  const cleanupRef = useRef<(() => void) | null>(null);
  return useCallback((node: T | null) => {
    cleanupRef.current?.(); // 이전 노드 리스너 해제
    cleanupRef.current = null;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 트랙패드 가로 스크롤은 네이티브에 맡김
      if (e.deltaY === 0 || node.scrollWidth <= node.clientWidth) return; // 넘길 게 없으면 페이지 스크롤 유지
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    cleanupRef.current = () => node.removeEventListener("wheel", onWheel);
  }, []);
}

export default function Input() {
  const { teams, loading: teamsLoading } = useTeams();
  const { games, loading: gamesLoading } = useGames();
  const { userId } = useAuth();
  const [gameId, setGameId] = useState<string | null>(null);
  const [unit, setUnit] = useState<number>(5);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("3");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const gameRowRef = useHorizontalWheel<HTMLDivElement>();
  const unitRowRef = useHorizontalWheel<HTMLDivElement>();

  const activeGames = games.filter((g) => g.active);
  // 입력 목록은 점수와 무관하게 이름순 고정 — 점수 변동으로 재정렬돼 오탭되는 것을 방지
  const orderedTeams = teams
    .filter((t) => t.active)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));

  const activeGameId = gameId ?? activeGames[0]?.id ?? null;
  const effectiveUnit = custom ? Number(customVal) || 0 : unit;
  const createdBy = userId;

  // 피드백 토스트 자동 사라짐
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), feedback.err ? 4000 : 3000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  async function give(teamId: string, sign: 1 | -1) {
    if (effectiveUnit === 0 || busy[teamId]) return; // 중복 탭 방지
    const points = sign * effectiveUnit;
    const teamName = teams.find((t) => t.id === teamId)?.name ?? "팀";
    setBusy((b) => ({ ...b, [teamId]: true }));
    try {
      const id = await addScore(teamId, activeGameId, points, createdBy);
      setFeedback({ err: false, msg: `${teamName} ${points >= 0 ? `+${points}` : points}`, entryId: id });
    } catch {
      setFeedback({ err: true, msg: "저장 실패 — 네트워크를 확인하고 다시 시도하세요" });
    } finally {
      setBusy((b) => ({ ...b, [teamId]: false }));
    }
  }

  async function undoLast() {
    if (!feedback?.entryId) return;
    try {
      await voidEntry(feedback.entryId);
      setFeedback(null);
    } catch {
      setFeedback({ err: true, msg: "취소 실패 — 다시 시도하세요" });
    }
  }

  if (teamsLoading || gamesLoading) return <LoadingScreen />;

  return (
    <>
      <Title>점수 입력</Title>

      {feedback && (
        <Toast $err={feedback.err}>
          {feedback.err ? <TriangleAlert size={17} /> : <Check size={17} />}
          <span>{feedback.msg}</span>
          {!feedback.err && feedback.entryId && (
            <ToastUndo onClick={() => void undoLast()}><Undo2 size={13} /> 되돌리기</ToastUndo>
          )}
        </Toast>
      )}

      <Label>게임 선택</Label>
      {activeGames.length === 0 ? (
        <Empty $variant="soft" style={{ marginBottom: 16 }}>게임이 없어요. 팀·게임 탭에서 추가하세요.</Empty>
      ) : (
        <ChipRow ref={gameRowRef}>
          {activeGames.map((g) => (
            <Chip key={g.id} $on={g.id === activeGameId} onClick={() => setGameId(g.id)}>{g.emoji} {g.name}</Chip>
          ))}
        </ChipRow>
      )}

      <Label>점수 단위</Label>
      <ChipRow ref={unitRowRef}>
        {SCORE_UNITS.map((u) => (
          <Chip key={u} $on={!custom && unit === u} onClick={() => { setCustom(false); setUnit(u); }}>+{u}</Chip>
        ))}
        <Chip $on={custom} onClick={() => setCustom(true)}>직접</Chip>
        {custom && (
          <CustomInput value={customVal} inputMode="numeric"
            onChange={(e) => setCustomVal(e.target.value.replace(/[^0-9]/g, ""))} />
        )}
      </ChipRow>

      {orderedTeams.map((t) => (
        <TeamCard key={t.id} $variant="medium">
          <Emoji>{t.emoji}</Emoji>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Pretendard',sans-serif" }}>{t.totalScore}</div>
          </div>
          <Step disabled={busy[t.id]} onClick={() => void give(t.id, -1)}><Minus size={22} color="#fff" /></Step>
          <Step $bg={t.color} disabled={busy[t.id]} onClick={() => void give(t.id, 1)}><Plus size={22} color="#fff" /></Step>
        </TeamCard>
      ))}
    </>
  );
}
