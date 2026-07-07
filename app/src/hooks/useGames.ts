import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Game } from "@/types";

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("games")
        .select("id, name, emoji, active")
        .order("created_at", { ascending: true });
      if (active && data) setGames(data as unknown as Game[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("games-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  return { games, loading };
}
