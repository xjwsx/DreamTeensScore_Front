export const TEAM_COLORS = [
  "#fb7185", "#fbbf24", "#a78bfa", "#4ade80",
  "#38bdf8", "#f472b6", "#fb923c", "#2dd4bf",
];

export const TEAM_EMOJIS = ["🦁", "🐬", "🦊", "🐨", "🐯", "🐼", "🐵", "🦄", "🐸", "🐷", "🐰", "🐻"];

export const GAME_EMOJIS = ["🎭", "🏃", "⚡", "🗺️", "🎤", "🎯", "🧩", "🎲", "🎨", "🎵"];

export const SCORE_UNITS = [1, 5, 10, 50];

// 게임당 정원(1:1 대결). 서버 set_team_game 의 2와 짝 — supabase/migrations/005_game_capacity.sql
export const MAX_TEAMS_PER_GAME = 2;
