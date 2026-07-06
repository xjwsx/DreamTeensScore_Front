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

export async function resetAll(): Promise<void> {
  const { error } = await supabase.from("score_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
}

export async function createTeam(name: string, emoji: string, color: string): Promise<void> {
  const { error } = await supabase.from("teams").insert({ name, emoji, color });
  if (error) throw error;
}
export async function updateTeam(id: string, patch: Partial<{ name: string; emoji: string; color: string }>): Promise<void> {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function createGame(name: string, emoji: string): Promise<void> {
  const { error } = await supabase.from("games").insert({ name, emoji });
  if (error) throw error;
}
export async function updateGame(id: string, patch: Partial<{ name: string; emoji: string }>): Promise<void> {
  const { error } = await supabase.from("games").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}
