/**
 * shoot.mjs — 보호자 앱 실제 화면을 PNG 로 뜬다 (기획서 발표자료용).
 *
 * 설치한 브라우저 자동화 도구가 없어 **Chrome DevTools Protocol 을 직접** 쓴다.
 * Node 22 의 전역 WebSocket 만 있으면 되고 의존성이 없다.
 *
 *   node scripts/shoot.mjs [베이스URL] [출력폴더]
 *   기본값: http://127.0.0.1:3200  ·  docs/proposal/shots
 *
 * ⚠️ 데모 로그인(`NEXT_PUBLIC_ENABLE_DEMO=1`)이 켜져 있어야 한다.
 * ⚠️ 로그인은 **네이티브 폼 제출**로 한다 — 이 환경에서 React onClick 은 안 걸린다.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3200";
const OUT = resolve(process.argv[3] ?? "docs/proposal/shots");
const PORT = 9333;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));
if (!CHROME) throw new Error("Chrome 을 찾지 못했습니다");

mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=2",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(OUT, ".chrome")}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CDP 연결 ──────────────────────────────────────────────────────────────
let ws, id = 0;
const pending = new Map();
const waiters = [];

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
function once(event, timeout = 15000) {
  return new Promise((res, rej) => {
    const w = { event, res };
    waiters.push(w);
    setTimeout(() => {
      const i = waiters.indexOf(w);
      if (i >= 0) { waiters.splice(i, 1); rej(new Error(event + " 시간 초과")); }
    }, timeout);
  });
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("CDP 에 붙지 못했습니다");
}

const wsUrl = await connect();
ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method) {
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].event === msg.method) waiters.splice(i, 1)[0].res(msg.params);
    }
  }
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 2, mobile: width < 600,
  });
}
async function go(path) {
  await send("Page.navigate", { url: BASE + path });
  await once("Page.loadEventFired").catch(() => {});
  await sleep(1400); // 서버 렌더 + 하이드레이션 여유
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.value;
}
/** 조건이 참이 될 때까지 기다린다 — 화면이 준비되기 전에 평가하면 조용히 빈손으로 돌아온다 */
async function waitFor(expr, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await evaluate(expr).catch(() => null);
    if (v) return v;
    await sleep(400);
  }
  throw new Error("대기 시간 초과: " + expr.slice(0, 60));
}
async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(OUT, name + ".png");
  writeFileSync(file, Buffer.from(data, "base64"));
  const kb = Math.round(Buffer.from(data, "base64").length / 1024);
  console.log(`  ✓ ${name}.png  ${kb}KB`);
}

// ── 로그인 (네이티브 폼 제출) ─────────────────────────────────────────────
await viewport(390, 844);
await go("/login/portal");
await waitFor(`[...document.querySelectorAll('button')].some(x=>x.textContent.includes('보호자'))`);
const ok = await evaluate(`(()=>{
  const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('보호자'));
  if(!b) return 'no-button';
  b.closest('form').requestSubmit(b);
  return 'submitted';
})()`);
console.log("로그인:", ok);
const landed = await waitFor("location.pathname.startsWith('/portal/patients/') && location.pathname", 30000);
console.log("도착:", landed);
if (!landed?.startsWith("/portal")) throw new Error("로그인 실패 — 데모 게이트를 확인하세요");

const pid = landed.split("/")[3];
const P = `/portal/patients/${pid}`;

// ── 보호자 앱 화면들 ──────────────────────────────────────────────────────
const shots = [
  ["home", P, "병원 소식 (첫 화면)"],
  ["life", `${P}/life`, "생활기록"],
  ["visits", `${P}/visits`, "진료 기록 목록"],
  ["cases", `${P}/cases`, "치료 사례"],
  ["profile", `${P}/profile`, "내 정보"],
];

for (const [name, path, label] of shots) {
  console.log(`\n${label}  ${path}`);
  await go(path);
  await shot(name);
}

// 회차 리포트 상세 — 목록에서 첫 회차 id 를 뽑아 들어간다
console.log("\n회차 리포트 상세");
await go(`${P}/visits`);
const vid = await evaluate(`(()=>{const a=document.querySelector('a[href*="/visits/"]');
  return a?a.getAttribute('href').split('/visits/')[1]:null;})()`);
if (vid) { await go(`${P}/visits/${vid}`); await shot("report"); }
else console.log("  · 회차가 없어 건너뜁니다");

// 건강검진 상세
console.log("\n건강검진");
const kid = await evaluate(`(()=>{const a=document.querySelector('a[href*="/checkups/"]');
  return a?a.getAttribute('href').split('/checkups/')[1]:null;})()`);
if (kid) { await go(`${P}/checkups/${kid}`); await shot("checkup"); }
else console.log("  · 검진이 없어 건너뜁니다");

// 직원 EMR — 생활기록 일/주/월 (데스크탑)
console.log("\n직원 EMR 생활기록");
await go("/login");
await waitFor(`[...document.querySelectorAll('button')].some(x=>x.textContent.includes('직원'))`);
await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('직원'));
  if(b) b.closest('form').requestSubmit(b);})()`);
await waitFor("!location.pathname.startsWith('/login') && location.pathname", 30000);
await viewport(1440, 900);
await go(`/patients/${pid}/life?g=week`);
await shot("staff-life");

console.log("\n완료 →", OUT);
ws.close();
chrome.kill();
process.exit(0);
