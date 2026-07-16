// Supabase 스키마의 수동 타입 정의 (schema.sql + 001·002 마이그레이션 기준).
// DB 컬럼이 바뀌면 여기만 고치면 되고, 타입드 클라이언트가 insert/update/select 를
// 컴파일 타임에 검증한다.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: { id: string; name: string; emoji: string; color: string; total_score: number; active: boolean; current_game_id: string | null; created_at: string };
        Insert: { id?: string; name: string; emoji?: string; color?: string; total_score?: number; active?: boolean; current_game_id?: string | null; created_at?: string };
        Update: { id?: string; name?: string; emoji?: string; color?: string; total_score?: number; active?: boolean; current_game_id?: string | null; created_at?: string };
        Relationships: [];
      };
      games: {
        Row: { id: string; name: string; emoji: string; active: boolean; floor: number; created_at: string };
        Insert: { id?: string; name: string; emoji?: string; active?: boolean; floor?: number; created_at?: string };
        Update: { id?: string; name?: string; emoji?: string; active?: boolean; floor?: number; created_at?: string };
        Relationships: [];
      };
      users: {
        Row: { id: string; name: string; login_id: string | null; role: "admin" | "staff"; created_at: string };
        Insert: { id: string; name: string; login_id?: string | null; role?: "admin" | "staff"; created_at?: string };
        Update: { id?: string; name?: string; login_id?: string | null; role?: "admin" | "staff"; created_at?: string };
        Relationships: [];
      };
      score_entries: {
        Row: {
          id: string; team_id: string; game_id: string | null; points: number;
          created_by: string | null; created_at: string; voided: boolean; archived_at: string | null;
        };
        Insert: {
          id?: string; team_id: string; game_id?: string | null; points: number;
          created_by?: string | null; created_at?: string; voided?: boolean; archived_at?: string | null;
        };
        Update: {
          id?: string; team_id?: string; game_id?: string | null; points?: number;
          created_by?: string | null; created_at?: string; voided?: boolean; archived_at?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: { id: string; action: string; actor: string | null; detail: Json; created_at: string };
        Insert: { id?: string; action: string; actor?: string | null; detail?: Json; created_at?: string };
        Update: { id?: string; action?: string; actor?: string | null; detail?: Json; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_team_game: { Args: { p_team: string; p_game: string | null }; Returns: undefined };
      clear_game: { Args: { p_game: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// 편의 별칭
export type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
export type GameRow = Database["public"]["Tables"]["games"]["Row"];
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type ScoreEntryRow = Database["public"]["Tables"]["score_entries"]["Row"];
export type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];
