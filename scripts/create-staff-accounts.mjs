// 부스(게임)당 스태프 계정 일괄 생성 스크립트.
//
// 활성 게임마다 booth01, booth02, … 아이디의 staff 계정을 만든다
// (Auth 유저 + public.users 프로필). 이미 있는 아이디는 건너뛰므로
// 여러 번 실행해도 안전하다. 생성된 아이디/비밀번호는 마지막에 표로 출력된다
// — 다시 볼 수 없으니 바로 복사해 두세요.
//
// 사용법 (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role 키>"
//   node scripts/create-staff-accounts.mjs
//
// service_role 키는 대시보드 → Settings → API 에 있다.
// ⚠ 이 키는 RLS 를 우회하는 전권 키다. 절대 커밋하거나 .env.local 의
//   VITE_ 접두사 변수로 넣지 말 것(클라이언트 번들에 노출됨).
//
// 주의: booth 번호는 실행 시점의 게임 순서(생성순)로 배정된다. 나중에
// 게임을 중간에서 삭제하고 재실행하면 번호가 밀릴 수 있으니, 그때는
// 대시보드에서 수동으로 관리하는 게 안전하다.

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

const EMAIL_DOMAIN = "dreamteens.local"; // src/lib/auth.ts 와 동일

function readEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error("VITE_SUPABASE_URL 을 찾지 못했습니다 (.env.local 확인).");
  process.exit(1);
}
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요 (대시보드 → Settings → API).");
  console.error('예: $env:SUPABASE_SERVICE_ROLE_KEY = "..."; node scripts/create-staff-accounts.mjs');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// 폰으로 입력하기 쉽도록 헷갈리는 글자(l/1, o/0 등)를 뺀 소문자+숫자 8자리
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const genPassword = () => Array.from({ length: 8 }, () => CHARS[randomInt(CHARS.length)]).join("");

// 앱과 같은 정렬(생성순 + id tie-breaker)로 활성 게임을 가져온다
const { data: games, error: gErr } = await supabase
  .from("games")
  .select("id, name")
  .eq("active", true)
  .order("created_at", { ascending: true })
  .order("id", { ascending: true });
if (gErr) {
  console.error("게임 목록을 불러오지 못했습니다:", gErr.message);
  process.exit(1);
}
if (!games.length) {
  console.error("활성 게임이 없습니다. 관리 페이지에서 게임을 먼저 만드세요.");
  process.exit(1);
}

const { data: existing, error: uErr } = await supabase.from("users").select("login_id");
if (uErr) {
  console.error("기존 계정 목록을 불러오지 못했습니다:", uErr.message);
  process.exit(1);
}
const taken = new Set(existing.map((u) => u.login_id));

const created = [];
let skipped = 0;

for (const [i, game] of games.entries()) {
  const loginId = `booth${String(i + 1).padStart(2, "0")}`;
  if (taken.has(loginId)) {
    console.log(`  ${loginId} — 이미 있어 건너뜀`);
    skipped++;
    continue;
  }

  const password = genPassword();
  const { data: authUser, error: aErr } = await supabase.auth.admin.createUser({
    email: `${loginId}@${EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });
  if (aErr) {
    console.error(`  ${loginId} — Auth 유저 생성 실패: ${aErr.message}`);
    continue;
  }

  const { error: pErr } = await supabase
    .from("users")
    .insert({ id: authUser.user.id, login_id: loginId, name: `${game.name} 부스`, role: "staff" });
  if (pErr) {
    // 프로필 없는 Auth 유저(로그인 불가 고아 계정)를 남기지 않는다
    await supabase.auth.admin.deleteUser(authUser.user.id);
    console.error(`  ${loginId} — 프로필 생성 실패(Auth 유저 되돌림): ${pErr.message}`);
    continue;
  }

  created.push({ 아이디: loginId, 비밀번호: password, 게임: game.name });
}

console.log(`\n생성 ${created.length}개 · 건너뜀 ${skipped}개 · 게임 ${games.length}개\n`);
if (created.length) {
  console.table(created);
  console.log("⚠ 비밀번호는 지금만 표시됩니다 — 표를 복사해 각 부스 스태프에게 전달하세요.");
  console.log("  비밀번호 분실 시: 대시보드 → Authentication → Users 에서 재설정.");
}
