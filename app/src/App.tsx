import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Scoreboard from "@/pages/Scoreboard";
import StaffScoring from "@/pages/StaffScoring";
import StaffHistory from "@/pages/StaffHistory";
import AdminConsole from "@/pages/AdminConsole";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/scoreboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        <Route path="/staff" element={<StaffScoring />} />
        <Route path="/staff/history" element={<StaffHistory />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="*" element={<Navigate to="/scoreboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
