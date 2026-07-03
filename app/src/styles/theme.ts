// iOS 네이티브 스타일 디자인 토큰
export const theme = {
  colors: {
    background: "#F2F2F7", // iOS 그룹 배경
    surface: "#FFFFFF",
    primary: "#007AFF", // iOS 블루
    success: "#34C759", // 가점 그린
    danger: "#FF3B30", // 감점 레드
    text: "#000000",
    textSecondary: "#8E8E93",
    separator: "#C6C6C8",
    // 순위 강조
    gold: "#FFD60A",
    silver: "#C7C7CC",
    bronze: "#D9A066",
  },
  radius: {
    sm: "10px",
    md: "14px",
    lg: "20px",
    pill: "999px",
  },
  spacing: (n: number) => `${n * 4}px`,
  font: {
    family:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    largeTitle: "34px",
    title: "20px",
    body: "17px",
    caption: "13px",
  },
  shadow: {
    card: "0 1px 3px rgba(0,0,0,0.08)",
  },
} as const;

export type AppTheme = typeof theme;
