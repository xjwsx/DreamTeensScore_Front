// 데이터 모델 (리디자인)
export type Role = "admin" | "staff";

export interface Team {
  id: string;
  name: string;
  emoji: string;
  color: string;
  totalScore: number;
  active: boolean;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
}

export interface ScoreEntry {
  id: string;
  teamId: string;
  gameId: string | null;
  points: number;
  createdBy: string | null;
  createdAt: string;
  voided: boolean;
  archivedAt: string | null; // 초기화(보관)된 기록. null=활성
}

export interface User {
  id: string;
  name: string;
  loginId: string | null;
  role: Role;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
