import { supabase } from "@/lib/supabase";

export type SessionRole = "admin" | "staff" | "viewer";

// Supabase Auth 는 이메일/전화만 식별자로 받으므로, 아이디를 내부적으로
// 가짜 이메일(아이디@도메인)로 매핑해 아이디/비밀번호 UX 를 유지한다.
const EMAIL_DOMAIN = "dreamteens.local";

export function emailForId(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export async function login(loginId: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailForId(loginId),
    password,
  });
  if (error) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
