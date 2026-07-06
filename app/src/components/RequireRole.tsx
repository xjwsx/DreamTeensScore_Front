import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { SessionRole } from "@/lib/auth";

export function RequireRole({ roles, children }: { roles: SessionRole[]; children: ReactNode }) {
  const { session, ready } = useAuth();
  if (!ready) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.role)) return <Navigate to="/board" replace />;
  return <>{children}</>;
}
