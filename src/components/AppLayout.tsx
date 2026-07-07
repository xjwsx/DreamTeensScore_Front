import { Outlet, useLocation } from "react-router-dom";
import { Screen, Blob, Content } from "@/components/ui";
import { TabBar } from "@/components/TabBar";

// 스태프 CRUD 화면(입력·기록·관리)은 넓은 화면에서 폭을 넓혀 그리드를 활용하고,
// 순위판은 랭킹 가독성을 위해 좁은 폭을 유지한다.
const WIDE_ROUTES = ["/input", "/log", "/manage"];

export function AppLayout() {
  const { pathname } = useLocation();
  const maxWidth = WIDE_ROUTES.includes(pathname) ? "1040px" : undefined;
  return (
    <Screen>
      <Blob $size={300} $top="-60px" $left="150px" $bg="radial-gradient(circle at 40% 40%,rgba(255,255,255,.4),transparent 60%)" />
      <Blob $size={240} $top="300px" $left="-70px" $bg="radial-gradient(circle,rgba(45,212,191,.5),transparent 65%)" />
      <Content $maxWidth={maxWidth}>
        <Outlet />
        <TabBar />
      </Content>
    </Screen>
  );
}
