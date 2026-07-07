import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ScoreEntry } from "@/types";

export function useScoreEntries(limit = 100) {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("score_entries")
        .select("id, teamId:team_id, gameId:game_id, points, createdBy:created_by, createdAt:created_at, voided, archivedAt:archived_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (active && data) setEntries(data as unknown as ScoreEntry[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("entries-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "score_entries" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [limit]);

  return { entries, loading };
}
