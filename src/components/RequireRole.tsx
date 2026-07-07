import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { SessionRole } from "@/lib/auth";

export function RequireRole({ roles, children }: { roles: SessionRole[]; children: ReactNode }) {
  const { role, ready } = useAuth();
  if (!ready) return null;
  if (!roles.includes(role)) {
    // 게스트(viewer)는 로그인 화면으로, 로그인했지만 권한이 부족하면 순위판으로.
    return <Navigate to={role === "viewer" ? "/login" : "/board"} replace />;
  }
  return <>{children}</>;
}
