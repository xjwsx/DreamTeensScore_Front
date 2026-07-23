import { type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { RequireRole } from "@/components/RequireRole";
import { AppLayout } from "@/components/AppLayout";
import { LoadingScreen } from "@/components/LoadingScreen";
import Login from "@/pages/Login";
import Scoreboard from "@/pages/Scoreboard";
import Input from "@/pages/Input";
import Records from "@/pages/Records";
import Manage from "@/pages/Manage";
import Present from "@/pages/Present";
import MapPage from "@/pages/Map";
import Notify from "@/pages/Notify";

// 인증 상태 확인 전(세션 복원 중)에는 로딩 화면을 보여 빈 화면 번쩍임을 막는다.
function AuthGate({ children }: { children: ReactNode }) {
  const { ready } = useAuth();
  if (!ready) return <LoadingScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate>
        <SettingsProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/board" element={<RequireRole roles={["admin", "staff", "viewer"]}><Scoreboard /></RequireRole>} />
            <Route path="/input" element={<RequireRole roles={["admin", "staff"]}><Input /></RequireRole>} />
            <Route path="/log" element={<RequireRole roles={["admin", "staff"]}><Records /></RequireRole>} />
            <Route path="/manage" element={<RequireRole roles={["admin"]}><Manage /></RequireRole>} />
            <Route path="/notify" element={<RequireRole roles={["admin"]}><Notify /></RequireRole>} />
            <Route path="/map" element={<RequireRole roles={["admin", "staff", "viewer"]}><MapPage /></RequireRole>} />
          </Route>
          <Route path="/present" element={<RequireRole roles={["admin", "staff", "viewer"]}><Present /></RequireRole>} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
        </SettingsProvider>
        </AuthGate>
      </BrowserRouter>
    </AuthProvider>
  );
}
