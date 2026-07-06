import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadSession, clearSession, type Session } from "@/lib/auth";

interface AuthValue {
  session: Session | null;
  ready: boolean;
  setSession: (s: Session | null) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, ready, setSession, logout: () => { clearSession(); setSession(null); } }),
    [session, ready]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
