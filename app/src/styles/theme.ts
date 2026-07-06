// 청량 아쿠아 디자인 토큰
export const theme = {
  colors: {
    ink: "#0e4b63",
    text: "#ffffff",
    screenGradient: "linear-gradient(165deg,#0ea5e9 0%,#22d3ee 45%,#2dd4bf 100%)",
    sky: "#0ea5e9",
    cyan: "#22d3ee",
    teal: "#2dd4bf",
    amber: "#fbbf24",
    rose: "#fb7185",
    cta: "#0e7490", // 흰 버튼 위 텍스트
    gold: "#fbbf24",
    silver: "#cbd5e1",
    bronze: "#fb923c",
  },
  glass: {
    strong: "linear-gradient(160deg,rgba(255,255,255,.30),rgba(150,235,255,.12))",
    medium: "linear-gradient(160deg,rgba(255,255,255,.24),rgba(150,235,255,.10))",
    soft: "linear-gradient(160deg,rgba(255,255,255,.18),rgba(150,235,255,.06))",
    border: "1px solid rgba(255,255,255,.45)",
    borderSoft: "1px solid rgba(255,255,255,.3)",
    insetHi: "inset 0 1px 0 rgba(255,255,255,.5)",
  },
  radius: { sm: "14px", md: "20px", lg: "24px", pill: "999px" },
  font: {
    body: "'Pretendard',system-ui,-apple-system,sans-serif",
    display: "'Pretendard',system-ui,sans-serif",
  },
} as const;

export type AppTheme = typeof theme;
