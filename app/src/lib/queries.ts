// 도메인 타입을 반환하는 조회 함수. 페이지/훅은 Supabase 세부 구현 대신 이 함수를 쓴다.
import { supabase } from "@/lib/supabase";
import { toTeam, toGame, toScoreEntry } from "@/lib/mappers";
import type { Team, Game, ScoreEntry } from "@/types";

export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("total_score", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error("팀을 불러오지 못했습니다.");
  return (data ?? []).map(toTeam);
}

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error("게임을 불러오지 못했습니다.");
  return (data ?? []).map(toGame);
}

export async function fetchScoreEntries(limit: number): Promise<ScoreEntry[]> {
  const { data, error } = await supabase
    .from("score_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("점수 기록을 불러오지 못했습니다.");
  return (data ?? []).map(toScoreEntry);
}
