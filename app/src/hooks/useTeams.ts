import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchTeams } from "@/lib/queries";

export function useTeams() {
  const { data, loading, error, refetch } = useRealtimeList("teams", fetchTeams);
  return { teams: data, loading, error, refetch };
}
