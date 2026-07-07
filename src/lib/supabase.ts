import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // 개발 초기: .env.local 미설정 시 콘솔 경고
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.example 참고."
  );
}

// 타입드 클라이언트 — 테이블명·컬럼·insert/update 페이로드가 컴파일 타임에 검증된다.
export const supabase = createClient<Database>(url ?? "", anonKey ?? "");
