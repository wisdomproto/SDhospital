/**
 * load-cautions.mjs — 추출본의 `_pending` 을 DB(patient_caution) 로 올린다.
 *
 *   node scripts/load-cautions.mjs "D:/sd hospital/_추출"
 *
 * ⚠️ **추출본은 D: 에만 있고 저장소에 들어가지 않는다.** 컴퓨터를 옮기면 사라진다.
 * 진료 기록은 이미 DB 에 있지만 「그 집의 사정」은 여기로 올려야 살아남는다.
 *
 * ⚠️ 로 시작하는 항목만 올린다 — 나머지는 "이미지 아직 안 읽음" 같은 작업 메모다.
 * 「사람 확인 필요 / 생사 불명 / 이후 회차 없음」 이면 confirm, 나머지는 context 로 나눈다.
 * 차트번호로 지우고 다시 넣는다 (여러 번 돌려도 같은 결과).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];
if (!ROOT) { console.error("사용법: node scripts/load-cautions.mjs <추출 루트>"); process.exit(1); }

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: "staff@sdhospital.test", password: "sdhospital123!",
});
if (authErr) throw new Error("직원 로그인 실패: " + authErr.message);

// 「사람이 확인해야 답할 수 있는 것」인지 「알고 있어야 하는 사정」인지
const CONFIRM = /확인 필요|확인 없이|생존 여부|이후 회차가 없|사람 확인|임종|확정되지 않|확인되지 않았다/;
// 항목 끝의 `|| kind=confirm` 은 추출본이 직접 고른 것 — 정규식보다 먼저 본다.
const KIND = /\s*\|\|\s*kind=(confirm|context)\s*$/;

let nPat = 0, nRow = 0;
for (const d of fs.readdirSync(ROOT)) {
  const file = path.join(ROOT, d, "환자.json");
  if (!fs.existsSync(file)) continue;
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = (j._pending ?? []).filter((p) => p.startsWith("⚠️") || p.startsWith("🚨"));
  if (!items.length) continue;

  const { data: p } = await sb.from("patient").select("id").eq("chart_no", j.chart_no).maybeSingle();
  if (!p) { console.warn(`  [${j.chart_no} ${j.name}] DB 에 없다 — 건너뜀`); continue; }

  await sb.from("patient_caution").delete().eq("patient_id", p.id);
  for (const raw of items) {
    const marked = raw.match(KIND);
    const body = raw.replace(KIND, "");
    const { error } = await sb.from("patient_caution").insert({
      patient_id: p.id,
      kind: marked ? marked[1] : CONFIRM.test(body) ? "confirm" : "context",
      body: body.replace(/^(⚠️|🚨)\s*/, "").trim(),
      source: `진료기록 추출 (${j.source_dir ?? j.chart_no})`,
    });
    if (!error) nRow++;
  }
  nPat++;
  console.log(`[${j.chart_no} ${j.name}] ${items.length}건`);
}
console.log(`\n${nPat}명 · ${nRow}건 적재 완료`);
process.exit(0);
