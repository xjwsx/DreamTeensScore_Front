// 데이터 모델 (리디자인)
export type Role = "admin" | "staff";

export interface Team {
  id: string;
  name: string;
  emoji: string;
  color: string;
  totalScore: number;
  active: boolean;
  currentGameId: string | null; // 팀이 지금 머무는 게임. null=대기(미배치)
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
  floor: number; // 게임이 위치한 층 (1 또는 2)
  room: string; // 방 이름 (예: 201호). "" = 미입력
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

export interface Setting {
  key: string;
  value: unknown; // jsonb — 사용처에서 좁힌다 (예: hide_scores 는 boolean)
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
