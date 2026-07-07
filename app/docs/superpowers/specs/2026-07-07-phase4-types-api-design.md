# 4단계 — 타입과 API 경계 정리 설계

**작성일:** 2026-07-07
**범위:** 코드 리팩터링만 (DB/스키마 변경 없음)

## 변경
- **`src/lib/database.types.ts`** — 스키마의 수동 `Database` 타입(테이블별 Row/Insert/Update). DB 컬럼이 바뀌면 여기만 고치면 됨.
- **타입드 클라이언트** — `createClient<Database>()`. 테이블명·컬럼·insert/update 페이로드가 컴파일 타임에 검증됨.
- **`src/lib/mappers.ts`** — row(snake_case) → 도메인(camelCase) 매퍼. `as unknown as` 캐스팅 제거.
- **`src/lib/queries.ts`** — `fetchTeams/fetchGames/fetchScoreEntries` 도메인 타입 반환. 페이지/훅이 Supabase 세부에 덜 의존.
- **`src/hooks/useRealtimeList.ts`** — 실시간 구독 공통 훅. `{data, loading, error, refetch}` 표준 제공(기존 error 무시 문제 해결).
- **훅 정리** — `useTeams/useGames/useScoreEntries`가 공통 훅의 얇은 래퍼로. 기존 반환 키(`teams/games/entries`) 유지해 소비자 무변경.
- **`api.ts`** — `fail(msg, error)` 헬퍼로 에러 메시지 표준화(PostgrestError 대신 한글 Error). 반환 타입 명시.

## 완료 기준 충족
- DB 컬럼 변경 시 `database.types.ts` + 매퍼/쿼리에서 TS가 문제를 잡음.
- 페이지 컴포넌트가 select 문자열·PostgrestError 등 Supabase 세부에 덜 의존.
