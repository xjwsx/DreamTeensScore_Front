import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { logout as authLogout, type SessionRole } from "@/lib/auth";

interface AuthValue {
  session: Session | null;
  role: SessionRole; // 'admin' | 'staff' | 'viewer'(비로그인 게스트)
  name: string | null;
  userId: string | null;
  ready: boolean;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<SessionRole>("viewer");
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    // 로그인 사용자의 역할·이름을 프로필(users)에서 읽어온다. 비로그인은 viewer.
    async function applyProfile(s: Session | null) {
      if (!s) {
        setRole("viewer");
        setName(null);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("role, name")
        .eq("id", s.user.id)
        .maybeSingle();
      if (!active) return;
      const prof = data as { role: "admin" | "staff"; name: string } | null;
      setRole(prof?.role ?? "viewer");
      setName(prof?.name ?? null);
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await applyProfile(data.session);
      if (active) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void applyProfile(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      role,
      name,
      userId: session?.user.id ?? null,
      ready,
      logout: authLogout,
    }),
    [session, role, name, ready]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
