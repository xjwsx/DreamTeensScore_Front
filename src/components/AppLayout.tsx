import { Outlet } from "react-router-dom";
import { Screen, Blob, Content } from "@/components/ui";
import { TabBar } from "@/components/TabBar";

export function AppLayout() {
  return (
    <Screen>
      <Blob $size={300} $top="-60px" $left="150px" $bg="radial-gradient(circle at 40% 40%,rgba(255,255,255,.4),transparent 60%)" />
      <Blob $size={240} $top="300px" $left="-70px" $bg="radial-gradient(circle,rgba(45,212,191,.5),transparent 65%)" />
      <Content>
        <Outlet />
        <TabBar />
      </Content>
    </Screen>
  );
}
