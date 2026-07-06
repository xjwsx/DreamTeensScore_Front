import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Trophy, User, KeyRound, ArrowRight, Eye } from "lucide-react";
import { Screen, Blob, Content, WhiteButton, GhostButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { login, viewerSession } from "@/lib/auth";

const Center = styled.div` flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px; `;
const Logo = styled.div`
  width: 88px; height: 88px; border-radius: 28px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, rgba(255,255,255,.4), rgba(255,255,255,.14));
  border: 1px solid rgba(255,255,255,.5);
  box-shadow: 0 12px 40px rgba(14,116,144,.4), inset 0 1px 0 rgba(255,255,255,.6);
`;
const Field = styled.div`
  display: flex; align-items: center; gap: 13px;
  background: ${({ theme }) => theme.glass.medium};
  border: ${({ theme }) => theme.glass.border};
  border-radius: 20px; padding: 17px 20px;
  & input { flex: 1; border: none; background: transparent; outline: none; color: #fff; font-size: 16px; }
  & input::placeholder { color: rgba(255,255,255,.65); }
`;
const Divider = styled.div`
  display: flex; align-items: center; gap: 14px; font-size: 13px; color: rgba(255,255,255,.5); padding: 4px 0;
  & span { flex: 1; height: 1px; background: rgba(255,255,255,.3); }
`;
const ErrorText = styled.div` font-size: 13px; color: #fff3b0; text-align: center; `;

export default function Login() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(""); setBusy(true);
    try {
      const s = await login(loginId, pw);
      setSession(s);
      nav("/board", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  function enterViewer() {
    setSession(viewerSession());
    nav("/board", { replace: true });
  }

  return (
    <Screen>
      <Blob $size={340} $top="-80px" $left="-40px" $bg="radial-gradient(circle at 35% 35%,rgba(255,255,255,.7),rgba(45,212,191,.2) 60%,transparent 72%)" />
      <Blob $size={200} $top="120px" $left="200px" $bg="radial-gradient(circle,rgba(14,165,233,.5),transparent 65%)" />
      <Content>
        <Center>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Logo><Trophy size={40} color="#fff" /></Logo>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,.7)" }}>SUMMER RETREAT · TEENS</div>
              <div style={{ fontSize: 38, fontWeight: 800 }}>틴즈 스코어보드</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field>
              <User size={20} color="rgba(255,255,255,.85)" />
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디 (관리자·스태프)" autoCapitalize="none" />
            </Field>
            <Field>
              <KeyRound size={20} color="rgba(255,255,255,.85)" />
              <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호" type="password"
                     onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <WhiteButton onClick={() => void submit()}>
              {busy ? "확인 중…" : "로그인"} <ArrowRight size={19} />
            </WhiteButton>
            <Divider><span /> 또는 <span /></Divider>
            <GhostButton onClick={enterViewer}><Eye size={18} /> 게스트로 순위 보기</GhostButton>
          </div>
        </Center>
      </Content>
    </Screen>
  );
}
