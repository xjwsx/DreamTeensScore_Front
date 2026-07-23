import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

// 에러 표준화: Supabase 세부(PostgrestError)를 노출하지 않고 한글 메시지로 던진다.
function fail(msg: string, error: unknown): never {
  console.error("[api]", msg, error);
  throw new Error(msg);
}

export async function addScore(
  teamId: string, gameId: string | null, points: number, createdBy: string | null
): Promise<string> {
  const { data, error } = await supabase
    .from("score_entries")
    .insert({ team_id: teamId, game_id: gameId, points, created_by: createdBy, voided: false })
    .select("id")
    .single();
  if (error || !data) fail("점수를 저장하지 못했습니다.", error);
  return data.id;
}

export async function voidEntry(id: string): Promise<void> {
  const { error } = await supabase.from("score_entries").update({ voided: true }).eq("id", id);
  if (error) fail("취소하지 못했습니다.", error);
}

// ---------- 감사 로그 (best-effort: 실패해도 주 작업을 막지 않음) ----------
export async function addAudit(
  action: string, actor: string | null, detail: Record<string, Json> = {}
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({ action, actor, detail });
  if (error) console.warn("[audit] 기록 실패:", error.message);
}

export interface ResetInfo {
  at: string;
  by: string | null;
}

export async function lastResetInfo(): Promise<ResetInfo | null> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("created_at, detail")
    .eq("action", "reset")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const row = data?.[0];
  if (!row) return null;
  const detail = (row.detail ?? {}) as { by?: string };
  return { at: row.created_at, by: detail.by ?? null };
}

// ---------- 초기화 = soft(보관) + 되돌리기 ----------
export async function resetAll(actorId: string | null, actorName: string | null): Promise<number> {
  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("score_entries")
    .update({ archived_at: stamp })
    .is("archived_at", null)
    .select("id");
  if (error) fail("초기화하지 못했습니다.", error);
  const count = data?.length ?? 0;
  await addAudit("reset", actorId, { by: actorName, at: stamp, count });
  return count;
}

export async function restoreLastReset(actorId: string | null): Promise<number> {
  const { data } = await supabase
    .from("score_entries")
    .select("archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.archived_at ?? null;
  if (!last) return 0;
  const { data: restored, error } = await supabase
    .from("score_entries")
    .update({ archived_at: null })
    .eq("archived_at", last)
    .select("id");
  if (error) fail("되돌리지 못했습니다.", error);
  const count = restored?.length ?? 0;
  await addAudit("reset_undo", actorId, { at: last, count });
  return count;
}

// ---------- 팀/게임: 비활성화(삭제 대신) ----------
export async function setTeamActive(id: string, active: boolean, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("teams").update({ active }).eq("id", id);
  if (error) fail("팀 상태를 바꾸지 못했습니다.", error);
  await addAudit(active ? "team_activate" : "team_deactivate", actorId, { teamId: id });
}
export async function setGameActive(id: string, active: boolean, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("games").update({ active }).eq("id", id);
  if (error) fail("게임 상태를 바꾸지 못했습니다.", error);
  await addAudit(active ? "game_activate" : "game_deactivate", actorId, { gameId: id });
}

// 점수 기록이 연결된 팀/게임은 DB(on delete restrict)가 완전 삭제를 막는다.
// UI 는 삭제 실패 시 "비활성화하세요" 안내로 대응한다.

// ---------- CRUD ----------
export async function createTeam(name: string, emoji: string, color: string): Promise<void> {
  const { error } = await supabase.from("teams").insert({ name, emoji, color });
  if (error) fail("팀을 추가하지 못했습니다.", error);
}
export async function updateTeam(id: string, patch: Partial<{ name: string; emoji: string; color: string }>): Promise<void> {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) fail("팀을 수정하지 못했습니다.", error);
}
export async function deleteTeam(id: string, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) fail("팀을 삭제하지 못했습니다.", error);
  await addAudit("team_delete", actorId, { teamId: id });
}

export async function createGame(name: string, emoji: string): Promise<void> {
  const { error } = await supabase.from("games").insert({ name, emoji });
  if (error) fail("게임을 추가하지 못했습니다.", error);
}
export async function updateGame(id: string, patch: Partial<{ name: string; emoji: string; floor: number; room: string }>): Promise<void> {
  const { error } = await supabase.from("games").update(patch).eq("id", id);
  if (error) fail("게임을 수정하지 못했습니다.", error);
}
export async function deleteGame(id: string, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) fail("게임을 삭제하지 못했습니다.", error);
  await addAudit("game_delete", actorId, { gameId: id });
}

// ---------- 팀 위치(맵): 스태프도 가능하도록 SECURITY DEFINER RPC 로 우회 ----------
// gameId=null 이면 대기(미배치)로 이동.
export async function setTeamGame(teamId: string, gameId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_team_game", { p_team: teamId, p_game: gameId });
  // P0001 = 함수 안 raise exception(정원 초과 등) — 사용자용 한글 메시지이므로 그대로 전달
  if (error) fail(error.code === "P0001" && error.message ? error.message : "팀 위치를 바꾸지 못했습니다.", error);
}

// 게임 종료: 그 게임에 있는 팀 전원을 대기로 (라운드 전환용, 원자적)
export async function clearGame(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("clear_game", { p_game: gameId });
  if (error) fail("게임을 비우지 못했습니다.", error);
}

// ---------- 전역 설정 ----------
// 스코어 가리기(게스트 순위 숨김). select 로 영향 행을 확인해
// 마이그레이션 006 미적용(행 없음)도 조용히 넘어가지 않고 에러로 알린다.
export async function setHideScores(hidden: boolean): Promise<void> {
  const { data, error } = await supabase
    .from("settings")
    .update({ value: hidden })
    .eq("key", "hide_scores")
    .select("key");
  if (error || !data?.length) fail("설정을 바꾸지 못했습니다.", error);
}

// 브로드캐스트 알람: announcement 행을 새 id + 메시지로 갱신한다.
// 접속 중인 클라이언트가 새 id 를 감지해 모달을 띄운다(수신 로직은 AnnouncementModal).
// setHideScores 처럼 .select() 로 영향 행을 확인해 마이그레이션 미적용(행 없음)을 에러로 알린다.
export async function sendAnnouncement(message: string): Promise<void> {
  const value = { id: crypto.randomUUID(), message };
  const { data, error } = await supabase
    .from("settings")
    .update({ value })
    .eq("key", "announcement")
    .select("key");
  if (error || !data?.length) fail("알람을 보내지 못했습니다.", error);
}
