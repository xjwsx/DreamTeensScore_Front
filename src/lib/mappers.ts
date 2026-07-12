// DB row(snake_case) → 도메인 타입(camelCase) 매퍼.
// 컬럼이 바뀌면 여기서 컴파일 에러가 나므로 변경 지점을 한곳에 모은다.
import type { TeamRow, GameRow, ScoreEntryRow } from "@/lib/database.types";
import type { Team, Game, ScoreEntry } from "@/types";

export function toTeam(r: TeamRow): Team {
  return { id: r.id, name: r.name, emoji: r.emoji, color: r.color, totalScore: r.total_score, active: r.active, currentGameId: r.current_game_id };
}

export function toGame(r: GameRow): Game {
  return { id: r.id, name: r.name, emoji: r.emoji, active: r.active };
}

export function toScoreEntry(r: ScoreEntryRow): ScoreEntry {
  return {
    id: r.id,
    teamId: r.team_id,
    gameId: r.game_id,
    points: r.points,
    createdBy: r.created_by,
    createdAt: r.created_at,
    voided: r.voided,
    archivedAt: r.archived_at,
  };
}
