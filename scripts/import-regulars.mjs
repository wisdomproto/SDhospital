/**
 * import-regulars.mjs — **우리 단골 42명**을 레퍼 환자와 같은 자리에 넣는다.
 *
 *   node scripts/import-regulars.mjs            # 미리보기만 (아무것도 안 쓴다)
 *   node scripts/import-regulars.mjs --write    # 실제로 넣는다
 *
 * `D:\sd hospital\일반환자\…(CSV)` 의 폴더 이름에서 환자를, CSV 에서 카톡 대화를 읽는다.
 * 진료 내용은 **여기 없다** — 스캔 이미지라 사람이 읽어야 하고, 그건 레퍼 쪽과 같은 작업이다.
 *
 * ⚠️ **이 아이들은 `origin='regular'` 다.** 채팅의 「경미하면 1차 병원으로」가 이 집들에는
 * 성립하지 않는다 — 우리가 그 1차다. 그래서 넣을 때부터 갈라 놓는다(`0039`).
 *
 * ⚠️ **생년월일은 근사치다.** 폴더에 「14Y」처럼 나이만 있어서 연도만 맞추고 1월 1일로 둔다.
 * 진료기록을 읽어 넣을 때 정확한 날짜로 덮어써야 한다. 없는 것보다 낫다고 판단했다 —
 * 나이를 모르면 채팅이 노령견인 걸 모른다.
 *
 * ⚠️ **보호자 실명을 그대로 쓴다**(원장님 지시). 폴더 이름에 있는 것이 실명이다.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/chat-eval.mjs";

const ROOT = process.env.SRC
  || "D:/sd hospital/일반환자/채널 101개 차트 자료 (105개 중 더케이 4건 제외) 8월 이후 채팅 갱신(CSV)";
const WRITE = process.argv.includes("--write");
const APP_OWNER = "5cbcfd44-1dfd-5582-9cd0-6c66908d9458"; // 데모 보호자 계정 — 레퍼 71명도 여기 붙어 있다
const HOSP = "SD동물의료센터";
const TODAY = "2026-08-18";

const SEX = { "S.FE": "중성화 암컷", "C.M": "중성화 수컷", FE: "암컷", MA: "수컷", M: "수컷", F: "암컷", "S.F": "중성화 암컷" };
const CAT = /숏헤어|숏 헤어|스핑크스|먼치킨|브리티시|샴|뱅갈|러시안|페르시안|스코티시|노르웨이|아비시니|메인쿤|코숏|랙돌|터키시|엑조틱/;
/** 채널이 자동으로 뱉는 것들. 「지난 대화」로 읽히면 안 된다 — 사람이 한 말이 아니다 */
const AUTO = /채팅 운영시간|본 채널에서는|채널을 추가|카카오톡채널을 추가|채널 추가|다양한 소식과 혜택/;

/** 「10219 코코(조현지) 푸들 S.FE 15Y 3.04KG」 — 품종이나 체중이 빠진 것도 있다 */
function parseFolder(d) {
  const m = d.match(/^(\d+)\s+(.+?)\((.+?)\)\s+(.*?)\s*(S\.FE|C\.M|S\.F|FE|MA|M|F)\s+(\d+)\s*(Y|M)(?:\s+([\d.]+)\s*KG)?\s*$/);
  if (!m) return null;
  const [, chart, name, owner, breed, sex, age, unit, kg] = m;
  return {
    chart, name: name.trim(), owner: owner.trim(),
    breed: breed.trim() || null,
    species: CAT.test(breed) ? "고양이" : "개",
    sex: SEX[sex] ?? sex,
    age: Number(age), unit,
    kg: kg ? Number(String(kg).replace(/\.+/g, ".").replace(/\.$/, "")) : null,
    folder: d,
  };
}

/** 나이 → 생년월일 근사치. 「6M」은 개월이라 그 달 1일로 */
function birthDate(p) {
  const [y, mo] = TODAY.split("-").map(Number);
  if (p.unit === "M") {
    const t = new Date(Date.UTC(y, mo - 1 - p.age, 1));
    return t.toISOString().slice(0, 10);
  }
  return `${y - p.age}-01-01`;
}

/** CSV 한 줄씩. 따옴표 안 줄바꿈이 있어서 split("\n") 으로는 안 된다 */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() ?? [];
  return rows.filter((r) => r.length >= 3).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
{
  const { error } = await sb.auth.signInWithPassword({ email: "staff@sdhospital.test", password: "sdhospital123!" });
  if (error) throw new Error("직원 로그인 실패: " + error.message);
}

const dirs = fs.readdirSync(ROOT).filter((d) => {
  const f = path.join(ROOT, d);
  return fs.statSync(f).isDirectory() && fs.readdirSync(f).some((x) => x.toLowerCase().endsWith(".csv"));
});

const pets = [], skipped = [];
for (const d of dirs) {
  const p = parseFolder(d);
  if (!p) { skipped.push(d); continue; }
  const files = fs.readdirSync(path.join(ROOT, d)).filter((x) => x.toLowerCase().endsWith(".csv"));
  p.msgs = files.flatMap((f) => parseCsv(fs.readFileSync(path.join(ROOT, d, f), "utf8")))
    .filter((r) => r.DATE && (r.MESSAGE ?? "").trim() && !AUTO.test(r.MESSAGE))
    .map((r) => ({ at: r.DATE.slice(0, 19).replace(" ", "T") + "+09:00",
                   role: (r.USER ?? "").includes(HOSP) ? "assistant" : "user",
                   text: r.MESSAGE.trim() }))
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  pets.push(p);
}

console.log(`폴더 ${dirs.length} · 환자 ${pets.length} · 이름 못 읽음 ${skipped.length}`);
skipped.forEach((s) => console.log("  ⚠️ " + s));
console.log(`카톡 ${pets.reduce((a, p) => a + p.msgs.length, 0).toLocaleString()}건 ` +
  `(보호자 ${pets.reduce((a, p) => a + p.msgs.filter((m) => m.role === "user").length, 0).toLocaleString()})`);

const { data: exist } = await sb.from("patient").select("chart_no").in("chart_no", pets.map((p) => p.chart));
const dup = new Set((exist ?? []).map((x) => x.chart_no));
if (dup.size) console.log(`⚠️ 이미 있는 차트번호 ${dup.size}건 — 건너뛴다: ${[...dup].join(", ")}`);

if (!WRITE) {
  console.log("\n=== 미리보기 (--write 를 붙여야 실제로 넣는다) ===");
  for (const p of pets.slice(0, 5)) {
    console.log(`  ${p.chart} ${p.name} · 보호자 ${p.owner} · ${p.species}·${p.breed ?? "품종 미상"}·${p.sex}` +
      ` · ${birthDate(p)} 생(근사) · ${p.kg ?? "?"}kg · 카톡 ${p.msgs.length}건`);
  }
  process.exit(0);
}

let nP = 0, nM = 0;
for (const p of pets) {
  if (dup.has(p.chart)) continue;
  const { data: own, error: oe } = await sb.from("owner")
    .insert({ name: p.owner, emr_no: p.chart }).select("id").single();
  if (oe) { console.log(`  ✗ ${p.name} 보호자: ${oe.message}`); continue; }
  const { data: pat, error: pe } = await sb.from("patient").insert({
    owner_id: APP_OWNER, emr_owner_id: own.id, chart_no: p.chart, name: p.name,
    species: p.species, breed: p.breed, sex: p.sex, birth_date: birthDate(p), origin: "regular",
  }).select("id").single();
  if (pe) { console.log(`  ✗ ${p.name}: ${pe.message}`); continue; }
  nP++;
  // 하루를 한 대화로 묶는다 — 실제로 그 날 오간 것이 한 덩어리다
  const byDay = new Map();
  for (const m of p.msgs) {
    const day = m.at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, crypto.randomUUID());
    m.thread = byDay.get(day);
  }
  for (let i = 0; i < p.msgs.length; i += 400) {
    const chunk = p.msgs.slice(i, i + 400).map((m) => ({
      patient_id: pat.id, thread_id: m.thread, role: m.role, content: m.text, created_at: m.at,
    }));
    const { error: ce } = await sb.from("chat_message").insert(chunk);
    if (ce) { console.log(`  ✗ ${p.name} 대화: ${ce.message}`); break; }
    nM += chunk.length;
  }
  console.log(`  ✓ ${p.name}(${p.chart}) 카톡 ${p.msgs.length}건`);
}
console.log(`\n환자 ${nP}명 · 메시지 ${nM.toLocaleString()}건 넣었다`);
process.exit(0);
