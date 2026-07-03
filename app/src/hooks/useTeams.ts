import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/types";

// 팀 목록을 실시간으로 구독. Supabase Realtime 연결 후 자동 갱신.
export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .order("totalScore", { ascending: false });
      if (active && data) setTeams(data as Team[]);
      setLoading(false);
    }
    void load();

    const channel = supabase
      .channel("teams-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => void load()
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { teams, loading };
}
