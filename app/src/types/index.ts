// 데이터 모델 (설계 문서 4장 기준)

export type ScoreMode = "fixed" | "ranked";
export type Role = "admin" | "staff";

export interface Team {
  id: string;
  name: string;
  color: string;
  totalScore: number;
}

export interface Game {
  id: string;
  name: string;
  scoreMode: ScoreMode;
  points: number; // 고정 점수 (감점은 음수)
  rankPoints: number[]; // 순위별 점수 [50,30,10] (ranked)
  staffIds: string[];
  oncePerTeam: boolean;
  active: boolean;
}

export interface ScoreEntry {
  id: string;
  teamId: string;
  gameId: string;
  points: number;
  rank: number | null;
  createdBy: string;
  createdAt: string;
  voided: boolean;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  gameScope: string[]; // 담당 게임 범위 (staff)
}
