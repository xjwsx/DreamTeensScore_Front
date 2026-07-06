// 데이터 모델 (리디자인)
export type Role = "admin" | "staff";

export interface Team {
  id: string;
  name: string;
  emoji: string;
  color: string;
  totalScore: number;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
}

export interface ScoreEntry {
  id: string;
  teamId: string;
  gameId: string | null;
  points: number;
  createdBy: string | null;
  createdAt: string;
  voided: boolean;
}

export interface User {
  id: string;
  name: string;
  loginId: string | null;
  role: Role;
}
