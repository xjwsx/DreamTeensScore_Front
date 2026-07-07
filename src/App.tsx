import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { RequireRole } from "@/components/RequireRole";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Scoreboard from "@/pages/Scoreboard";
import Input from "@/pages/Input";
import Records from "@/pages/Records";
import Manage from "@/pages/Manage";
import Present from "@/pages/Present";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/board" element={<RequireRole roles={["admin", "staff", "viewer"]}><Scoreboard /></RequireRole>} />
            <Route path="/input" element={<RequireRole roles={["admin", "staff"]}><Input /></RequireRole>} />
            <Route path="/log" element={<RequireRole roles={["admin", "staff"]}><Records /></RequireRole>} />
            <Route path="/manage" element={<RequireRole roles={["admin"]}><Manage /></RequireRole>} />
          </Route>
          <Route path="/present" element={<RequireRole roles={["admin", "staff", "viewer"]}><Present /></RequireRole>} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
