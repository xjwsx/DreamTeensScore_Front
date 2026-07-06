import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  @import url('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard.min.css');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    font-family: ${({ theme }) => theme.font.body};
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.ink};
    -webkit-font-smoothing: antialiased;
  }
  button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
  a { color: inherit; text-decoration: none; }
  input { font-family: inherit; }
`;
