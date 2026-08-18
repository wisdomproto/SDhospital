/**
 * load-emr.mjs — 원장님 EMR 추출본을 DB 에 넣는다.
 *
 *   node scripts/load-emr.mjs "D:/sd hospital/_추출"          전부
 *   node scripts/load-emr.mjs "D:/sd hospital/_추출" 5686     한 명만
 *
 * 입력은 `<루트>/<차트번호>/환자.json` (진료기록 이미지를 읽어 만든 것) 과
 * 원본 폴더의 카톡 CSV 다.
 *
 * ⚠️ **실제 환자 데이터다.** 추출본도 이 스크립트의 출력도 저장소에 들어가지 않는다.
 * ⚠️ 직원 세션으로 넣는다 — 외부 역할은 RLS 로 막혀 있고, 막혀 있어야 맞다.
 * 여러 번 돌려도 같은 결과가 되게 **차트번호로 지우고 다시 넣는다**
 * (검진 저장이 upsert 대신 지우고 다시 넣는 것과 같은 이유 — 부분 갱신이 더 위험하다).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];
const ONLY = process.argv[3];
if (!ROOT) {
  console.error("사용법: node scripts/load-emr.mjs <추출 루트> [차트번호]");
  process.exit(1);
}

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: "staff@sdhospital.test",
  password: "sdhospital123!",
});
if (authErr) throw new Error("직원 로그인 실패: " + authErr.message);

/** 카톡 CSV 한 줄씩 (따옴표 안 줄바꿈이 있어 직접 파싱한다) */
function readCsv(file) {
  const s = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/**
 * ⚠️ **모든 환자를 데모 보호자 하나에 묶는다.** 보호자 계정을 106개 만들지 않기로 했다.
 * `owner_id` 는 RLS 가 지나가는 통로일 뿐이고, 진짜 보호자는 `emr_owner_id` 가 가리킨다.
 * 보호자 계정을 실제로 발급하면 둘이 같아진다.
 */
const DEMO_OWNER = "5cbcfd44-1dfd-5582-9cd0-6c66908d9458";

const BOT = ["채팅 운영시간", "본 채널에서는 진료 예약", "진료·증상 상담은 채널", "상담 가능 시간", "야간 중 채널"];

async function load(dir) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, "환자.json"), "utf8"));
  const tag = `[${j.chart_no} ${j.name}]`;

  // ── 보호자 ──────────────────────────────────────────────────────────────
  let ownerId;
  const { data: o0 } = await sb.from("owner").select("id").eq("emr_no", j.owner_emr_no).maybeSingle();
  if (o0) {
    ownerId = o0.id;
    await sb.from("owner").update({ name: j.owner_name, contact: j.owner_contact, address: j.owner_address }).eq("id", ownerId);
  } else {
    const { data, error } = await sb.from("owner")
      .insert({ name: j.owner_name, contact: j.owner_contact, address: j.owner_address, emr_no: j.owner_emr_no })
      .select("id").single();
    if (error) throw error;
    ownerId = data.id;
  }

  // ── 환자 ────────────────────────────────────────────────────────────────
  let patientId;
  const { data: p0 } = await sb.from("patient").select("id").eq("chart_no", j.chart_no).maybeSingle();
  const pfields = {
    owner_id: DEMO_OWNER, emr_owner_id: ownerId,
    name: j.name, species: j.species, breed: j.breed,
    sex: j.sex, birth_date: j.birth_date, chart_no: j.chart_no,
    // ⚠️ 떠난 아이는 여기 남긴다 — 채팅이 살아 있는 것처럼 말하면 안 된다
    note: j.deceased ? `사망: ${j.deceased_note ?? "기록에 사망 언급"}` : null,
    // ⚠️ 의뢰받은 아이냐 우리 단골이냐(`0039`). 안 주면 의뢰로 본다 —
    // 이 스크립트가 처음 쓰인 곳이 레퍼 환자였고, 기본값이 그쪽이라야 예전 추출본이 그대로 돈다.
    origin: j.origin ?? "referral",
  };
  if (p0) {
    patientId = p0.id;
    await sb.from("patient").update(pfields).eq("id", patientId);
    // 다시 넣기 — 부분 갱신보다 지우고 새로 쓰는 게 어긋날 여지가 없다
    await sb.from("visit").delete().eq("patient_id", patientId);
    await sb.from("chat_message").delete().eq("patient_id", patientId);
  } else {
    const { data, error } = await sb.from("patient").insert(pfields).select("id").single();
    if (error) throw error;
    patientId = data.id;
  }

  // ── 회차 · 처방 ─────────────────────────────────────────────────────────
  const visitIdByAt = new Map();
  for (const v of j.visits) {
    const { data, error } = await sb.from("visit").insert({
      patient_id: patientId,
      visit_date: v.at.slice(0, 10),
      chief_complaint: v.cc || null,
      note: v.note || null,
      weight_kg: j.weight_kg ?? null,
      closed_at: new Date(v.at.replace(" ", "T") + ":00+09:00").toISOString(),
    }).select("id").single();
    if (error) throw error;
    visitIdByAt.set(v.at, data.id);

    for (const item of v.plan ?? []) {
      // 약·처치를 drug 마스터에 모은다. 코드가 있으면 코드가 곧 식별자다
      let drugId;
      const { data: d0 } = await sb.from("drug").select("id").eq("name", item.item).maybeSingle();
      if (d0) drugId = d0.id;
      else {
        const { data, error } = await sb.from("drug")
          .insert({ name: item.item, spec: item.code ?? null, note: "EMR Plan" })
          .select("id").single();
        if (error) throw error;
        drugId = data.id;
      }
      await sb.from("prescription").insert({
        visit_id: data.id, drug_id: drugId,
        dose: item.dose ?? null, frequency: item.qty ?? null, note: item.route ?? null,
      });
    }
  }

  // ── 입원 ────────────────────────────────────────────────────────────────
  for (const a of j.admissions ?? []) {
    const vid = visitIdByAt.get(a.visit_at) ?? [...visitIdByAt.values()][0];
    if (!vid) continue;
    await sb.from("admission").insert({
      patient_id: patientId, visit_id: vid,
      admitted_at: a.admitted_at, discharged_at: a.discharged_at ?? null,
      status: a.status ?? "discharged", note: a.note ?? null,
    });
  }

  // ── 카톡 → 지난 대화 ────────────────────────────────────────────────────
  // 하루를 한 타래로 묶는다. 카톡은 스레드 개념이 없고, 실제로 하루 단위로 오간다.
  let chats = 0;
  // 원본(카톡 CSV 가 있는) 폴더. 레퍼는 `_추출` 옆에 있었고, 단골은 다른 데 있다 —
  // `환자.json` 의 `source_root` 가 있으면 그걸 쓰고, 없으면 예전 자리를 본다.
  const srcDir = j.source_dir
    ? (j.source_root
        ? path.join(j.source_root, j.source_dir)
        : path.join(path.dirname(path.dirname(dir)), "AI학습용-이민수원장님-20260812T141155Z-1-001", j.source_dir))
    : null;
  const csvs = srcDir && fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".csv")).map((f) => path.join(srcDir, f))
    : [];
  const threadOfDay = new Map();
  for (const c of csvs) {
    const rows = readCsv(c).slice(1);
    for (const r of rows) {
      const [at, user, msg] = r;
      if (!at || !msg) continue;
      if (BOT.some((b) => msg.includes(b))) continue;
      if (msg.trim() === "사진" || msg.trim() === "동영상") continue;
      const day = at.slice(0, 10);
      if (!threadOfDay.has(day)) threadOfDay.set(day, crypto.randomUUID());
      const { error } = await sb.from("chat_message").insert({
        patient_id: patientId,
        thread_id: threadOfDay.get(day),
        role: user.includes("SD동물의료센터") ? "assistant" : "user",
        content: msg,
        model: "kakao",
        created_at: new Date(at.replace(" ", "T") + "+09:00").toISOString(),
      });
      if (!error) chats++;
    }
  }

  console.log(`${tag} 회차 ${j.visits.length} · 입원 ${(j.admissions ?? []).length} · 카톡 ${chats}`);
}

const dirs = fs.readdirSync(ROOT)
  .filter((d) => fs.existsSync(path.join(ROOT, d, "환자.json")))
  .filter((d) => !ONLY || d === ONLY);
if (!dirs.length) { console.error("환자.json 이 없다:", ROOT); process.exit(1); }
for (const d of dirs) await load(path.join(ROOT, d));
console.log(`\n${dirs.length}명 적재 완료`);
process.exit(0);
