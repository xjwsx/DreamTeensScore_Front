import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/types";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("teams")
        .select("id, name, emoji, color, totalScore:total_score, active")
        .order("total_score", { ascending: false })
        .order("created_at", { ascending: true });
      if (active && data) setTeams(data as unknown as Team[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("teams-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  return { teams, loading };
}
