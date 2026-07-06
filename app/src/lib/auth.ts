import { supabase } from "@/lib/supabase";

export type SessionRole = "admin" | "staff" | "viewer";

export interface Session {
  userId: string;
  name: string;
  role: SessionRole;
  token: string;
}

const SESSION_KEY = "dtscore.session";

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeToken(userId: string): string {
  return `${userId}.${Date.now().toString(36)}`;
}

export function saveSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
export function viewerSession(): Session {
  return { userId: "viewer", name: "게스트", role: "viewer", token: "viewer" };
}

export async function login(loginId: string, password: string): Promise<Session> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role, passwordHash:password_hash")
    .eq("login_id", loginId.trim())
    .maybeSingle();
  if (error) throw new Error("로그인 중 오류가 발생했습니다.");
  if (!data) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  const row = data as unknown as { id: string; name: string; role: "admin" | "staff"; passwordHash: string | null };
  const hash = await sha256Hex(password);
  if (!row.passwordHash || hash !== row.passwordHash) {
    throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  const session: Session = { userId: row.id, name: row.name, role: row.role, token: makeToken(row.id) };
  saveSession(session);
  return session;
}
