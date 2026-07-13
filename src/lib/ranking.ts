import type { Team } from "@/types";

export interface RankedTeam {
  team: Team;
  /** 표준 경쟁 순위(공동 순위, 1-2-2-4): 동점은 같은 등수, 다음 등수는 동점 인원만큼 건너뛴다. */
  rank: number;
  /** 같은 총점을 가진 다른 팀이 있는지 — "공동 N위" 표기 여부. */
  tied: boolean;
}

/**
 * 총점 내림차순으로 정렬된 팀 목록에 공동(경쟁) 순위를 매긴다.
 * 입력은 fetchTeams 순서(total_score desc, created_at asc)를 가정한다 —
 * 목록 표시 순서는 그대로 두고 등수 숫자만 계산한다.
 */
export function rankTeams(teams: Team[]): RankedTeam[] {
  const out: RankedTeam[] = [];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const prev = teams[i - 1];
    const next = teams[i + 1];
    const sameAsPrev = prev !== undefined && prev.totalScore === team.totalScore;
    const sameAsNext = next !== undefined && next.totalScore === team.totalScore;
    const rank = sameAsPrev ? out[i - 1].rank : i + 1;
    out.push({ team, rank, tied: sameAsPrev || sameAsNext });
  }
  return out;
}
