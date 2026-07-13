import { useNavigate, useLocation } from "react-router-dom";
import styled from "styled-components";
import { Trophy, Plus, Clock, Settings, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { SessionRole } from "@/lib/auth";

const Bar = styled.div`
  margin-top: auto; display: flex; align-items: center; gap: 8px;
  align-self: center; width: 100%; max-width: 480px;
  background: ${({ theme }) => theme.glass.strong};
  border: ${({ theme }) => theme.glass.border};
  border-radius: 26px; padding: 10px;
`;
const Tab = styled.button<{ $on?: boolean }>`
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; border-radius: 18px; font-size: 12px; font-weight: 700;
  color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "transparent")};
`;

interface TabDef { to: string; label: string; icon: typeof Trophy; roles: SessionRole[] }
const TABS: TabDef[] = [
  { to: "/board", label: "순위", icon: Trophy, roles: ["admin", "staff", "viewer"] },
  { to: "/map", label: "맵", icon: MapPin, roles: ["admin", "staff", "viewer"] },
  { to: "/input", label: "입력", icon: Plus, roles: ["admin", "staff"] },
  { to: "/log", label: "기록", icon: Clock, roles: ["admin", "staff"] },
  { to: "/manage", label: "팀·게임", icon: Settings, roles: ["admin"] },
];

export function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { role } = useAuth();
  const tabs = TABS.filter((t) => t.roles.includes(role));

  return (
    <Bar>
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = pathname === t.to;
        return (
          <Tab key={t.to} $on={on} onClick={() => nav(t.to)}>
            <Icon size={20} color={on ? "#0e7490" : "#fff"} />
            {t.label}
          </Tab>
        );
      })}
    </Bar>
  );
}
