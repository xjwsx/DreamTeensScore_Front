import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchGames } from "@/lib/queries";

export function useGames() {
  const { data, loading, error, refetch } = useRealtimeList("games", fetchGames);
  return { games: data, loading, error, refetch };
}
