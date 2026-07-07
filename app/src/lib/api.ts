import { supabase } from "@/lib/supabase";

export async function addScore(
  teamId: string, gameId: string | null, points: number, createdBy: string | null
): Promise<void> {
  const { error } = await supabase.from("score_entries").insert({
    team_id: teamId, game_id: gameId, points, created_by: createdBy, voided: false,
  });
  if (error) throw error;
}

export async function voidEntry(id: string): Promise<void> {
  const { error } = await supabase.from("score_entries").update({ voided: true }).eq("id", id);
  if (error) throw error;
}

// ---------- 감사 로그 (best-effort: 실패해도 주 작업을 막지 않음) ----------
export async function addAudit(
  action: string, actor: string | null, detail: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({ action, actor, detail });
  if (error) console.warn("[audit] 기록 실패:", error.message);
}

export interface ResetInfo {
  at: string;
  by: string | null;
}

export async function lastResetInfo(): Promise<ResetInfo | null> {
  const { data } = await supabase
    .from("audit_log")
    .select("createdAt:created_at, detail")
    .eq("action", "reset")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0] as { createdAt: string; detail: { by?: string } } | undefined;
  if (!row) return null;
  return { at: row.createdAt, by: row.detail?.by ?? null };
}

// ---------- 초기화 = soft(보관) + 되돌리기 ----------
export async function resetAll(actorId: string | null, actorName: string | null): Promise<number> {
  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("score_entries")
    .update({ archived_at: stamp })
    .is("archived_at", null)
    .select("id");
  if (error) throw error;
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
  const last = (data?.[0] as { archived_at: string } | undefined)?.archived_at;
  if (!last) return 0;
  const { data: restored, error } = await supabase
    .from("score_entries")
    .update({ archived_at: null })
    .eq("archived_at", last)
    .select("id");
  if (error) throw error;
  const count = restored?.length ?? 0;
  await addAudit("reset_undo", actorId, { at: last, count });
  return count;
}

// ---------- 팀/게임: 비활성화(삭제 대신) ----------
export async function setTeamActive(id: string, active: boolean, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("teams").update({ active }).eq("id", id);
  if (error) throw error;
  await addAudit(active ? "team_activate" : "team_deactivate", actorId, { teamId: id });
}
export async function setGameActive(id: string, active: boolean, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("games").update({ active }).eq("id", id);
  if (error) throw error;
  await addAudit(active ? "game_activate" : "game_deactivate", actorId, { gameId: id });
}

// 점수 기록이 연결된 팀/게임은 DB(on delete restrict)가 완전 삭제를 막는다.
// UI 는 삭제 실패 시 "비활성화하세요" 안내로 대응한다.

// ---------- CRUD ----------
export async function createTeam(name: string, emoji: string, color: string): Promise<void> {
  const { error } = await supabase.from("teams").insert({ name, emoji, color });
  if (error) throw error;
}
export async function updateTeam(id: string, patch: Partial<{ name: string; emoji: string; color: string }>): Promise<void> {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTeam(id: string, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
  await addAudit("team_delete", actorId, { teamId: id });
}

export async function createGame(name: string, emoji: string): Promise<void> {
  const { error } = await supabase.from("games").insert({ name, emoji });
  if (error) throw error;
}
export async function updateGame(id: string, patch: Partial<{ name: string; emoji: string }>): Promise<void> {
  const { error } = await supabase.from("games").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteGame(id: string, actorId: string | null): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
  await addAudit("game_delete", actorId, { gameId: id });
}
