import { Outlet, useLocation } from "react-router-dom";
import styled from "styled-components";
import { Screen, Blob, Content } from "@/components/ui";
import { TabBar } from "@/components/TabBar";

// 탭바 위 여백 확보용 스페이서. 내용이 짧으면 늘어나 탭바를 화면 바닥에 붙이고,
// 내용이 길어도(예: 맵의 게임 카드) min-height 로 탭바와 카드 사이 여백을 항상 유지한다.
const TabSpacer = styled.div`
  flex: 1 1 auto;
  min-height: 20px;
`;

// 스태프 CRUD 화면(입력·기록·관리)은 넓은 화면에서 폭을 넓혀 그리드를 활용하고,
// 순위판은 랭킹 가독성을 위해 좁은 폭을 유지한다.
const WIDE_ROUTES = ["/input", "/log", "/manage", "/map"];

export function AppLayout() {
  const { pathname } = useLocation();
  const maxWidth = WIDE_ROUTES.includes(pathname) ? "1040px" : undefined;
  return (
    <Screen>
      <Blob $size={300} $top="-60px" $left="150px" $bg="radial-gradient(circle at 40% 40%,rgba(255,255,255,.4),transparent 60%)" />
      <Blob $size={240} $top="300px" $left="-70px" $bg="radial-gradient(circle,rgba(45,212,191,.5),transparent 65%)" />
      <Content $maxWidth={maxWidth}>
        <Outlet />
        <TabSpacer />
        <TabBar />
      </Content>
    </Screen>
  );
}
